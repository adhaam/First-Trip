import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Static assertions on the raw SQL text of migration 051 — no database
// required. The behaviour itself is proven by supabase/tests/journey_amendments.sql
// (run by scripts/db-bootstrap-check.sh); these guard the contract points that
// are easy to silently break in a future edit.

const sql = readFileSync(join(process.cwd(), 'supabase', 'migrations', '051_journey_amendments.sql'), 'utf8')

const fnStart = sql.indexOf('CREATE OR REPLACE FUNCTION public.weemap_amend_trip_request')
const fnEnd = sql.indexOf('REVOKE ALL ON FUNCTION public.weemap_amend_trip_request')
const fn = sql.slice(fnStart, fnEnd)

function codeLines(text: string) {
  return text.split(/\r?\n/).map((line) => line.replace(/--.*$/, ''))
}

test('weemap_amend_trip_request is a service_role-only SECURITY DEFINER with a pinned search_path', () => {
  assert.ok(fn.length > 0, 'function body must be found')
  assert.match(fn, /RETURNS JSONB\s+LANGUAGE plpgsql\s+SECURITY DEFINER\s+SET search_path = public, pg_temp/)
  assert.match(
    sql,
    /REVOKE ALL ON FUNCTION public\.weemap_amend_trip_request\(UUID, TIMESTAMPTZ, JSONB, JSONB, NUMERIC, JSONB, TEXT\)\s+FROM PUBLIC, anon, authenticated;/,
  )
  assert.match(
    sql,
    /GRANT EXECUTE ON FUNCTION public\.weemap_amend_trip_request\(UUID, TIMESTAMPTZ, JSONB, JSONB, NUMERIC, JSONB, TEXT\)\s+TO service_role;/,
  )
})

test('guards run in order: lock, stale, closed, paid, then input validation, before any write', () => {
  const order = [
    'FOR UPDATE;',
    "RAISE EXCEPTION 'not_found'",
    "RAISE EXCEPTION 'stale_request' USING ERRCODE = 'PT409'",
    "RAISE EXCEPTION 'amendment_closed' USING ERRCODE = 'check_violation'",
    "RAISE EXCEPTION 'amendment_paid_journey' USING ERRCODE = 'check_violation'",
    "RAISE EXCEPTION 'invalid_amendment' USING ERRCODE = 'invalid_parameter_value'",
    'INSERT INTO public.trip_request_revisions',
    'UPDATE public.trip_requests SET',
  ]
  let last = -1
  for (const marker of order) {
    const at = fn.indexOf(marker)
    assert.ok(at > -1, `missing marker: ${marker}`)
    assert.ok(at > last, `marker out of order: ${marker}`)
    last = at
  }
})

test('paid guard looks at the parent amount_paid and at the ledger for the parent and both child kinds', () => {
  assert.match(fn, /COALESCE\(r\.amount_paid, 0\) > 0/)
  assert.match(fn, /pr\.entity_type = 'trip_request' AND pr\.entity_id = r\.id/)
  assert.match(fn, /pr\.entity_type = 'accommodation_booking' AND pr\.entity_id = b\.id/)
  assert.match(fn, /pr\.entity_type = 'trip_booking' AND pr\.entity_id = tb\.id/)
})

test('an awaiting_payment / confirmed journey goes back to checking_availability', () => {
  assert.match(fn, /regress := r\.status IN \('awaiting_payment', 'confirmed'\);/)
  assert.match(fn, /new_status := CASE WHEN regress THEN 'checking_availability' ELSE r\.status END;/)
})

test('the migration never writes the money ledger or the parent payment columns', () => {
  for (const line of codeLines(sql)) {
    assert.doesNotMatch(line, /\b(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+(public\.)?payment_records\b/i, `touches payment_records: "${line}"`)
    assert.doesNotMatch(line, /\bamount_paid\s*=/i, `assigns amount_paid: "${line}"`)
    assert.doesNotMatch(line, /\bpayment_status\s*=\s*(?!r\.)/i, `assigns payment_status: "${line}"`)
  }
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+public\.(bookings|trip_bookings)\b/i, 'fulfilment children are never deleted')
})

test('agreed_total only moves under weemap.payment_maintenance and only for converted journeys', () => {
  assert.match(fn, /agreed_total = CASE WHEN converted THEN p_quoted_total ELSE agreed_total END/)
  const on = fn.indexOf("set_config('weemap.payment_maintenance', 'on', true)")
  const update = fn.indexOf('UPDATE public.trip_requests SET')
  const restore = fn.indexOf("set_config('weemap.payment_maintenance', prev_pay_maint, true)")
  assert.ok(on > -1 && update > -1 && restore > -1, 'maintenance on / update / restore must all be present')
  assert.ok(on < update && update < restore, 'maintenance flag must wrap the parent update')
  assert.match(fn, /IF converted THEN\s+-- agreed_total follows the new quote/)
})

test('converted journeys re-sync children in place: split like conversion, cancel removed trips, never delete', () => {
  assert.match(fn, /side_total := p_quoted_total - trips_total - pkgs_total;/)
  assert.match(fn, /IF side_total < 0 THEN\s+RAISE EXCEPTION 'snapshot_mismatch' USING ERRCODE = 'check_violation';/)
  assert.match(fn, /COALESCE\(trip_id, trip_package_id\) = exp_id/)
  assert.match(fn, /status = 'cancelled',\s+internal_notes = btrim\(COALESCE\(internal_notes, ''\) \|\| E'\\nRemoved by amendment rev ' \|\| rev_no\)/)
  assert.match(fn, /UPDATE public\.bookings SET[\s\S]*total_price = side_total/)
})

test('revisions: append-only table, RLS on with no policies, service_role may only SELECT', () => {
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.trip_request_revisions/)
  assert.match(sql, /trip_request_id\s+UUID NOT NULL REFERENCES public\.trip_requests\(id\) ON DELETE CASCADE/)
  assert.match(sql, /UNIQUE \(trip_request_id, revision_number\)/)
  assert.match(sql, /kind\s+TEXT NOT NULL CHECK \(kind IN \('original', 'amendment'\)\)/)
  assert.match(sql, /ALTER TABLE public\.trip_request_revisions ENABLE ROW LEVEL SECURITY;/)
  assert.doesNotMatch(sql, /CREATE POLICY/i)
  assert.match(sql, /REVOKE ALL ON public\.trip_request_revisions FROM PUBLIC, anon, authenticated, service_role;/)
  assert.match(sql, /GRANT SELECT ON public\.trip_request_revisions TO service_role;/)
  assert.match(sql, /BEFORE UPDATE ON public\.trip_request_revisions/)
  assert.match(sql, /BEFORE DELETE ON public\.trip_request_revisions/)
  // The delete trigger only lets a cascade or a maintenance transaction through.
  assert.match(sql, /current_setting\('weemap\.payment_maintenance', true\) = 'on'/)
  assert.match(sql, /IF EXISTS \(SELECT 1 FROM public\.trip_requests WHERE id = OLD\.trip_request_id\) THEN\s+RAISE EXCEPTION 'revision_append_only'/)
})

test('the migration is re-runnable: IF NOT EXISTS / OR REPLACE / DROP TRIGGER IF EXISTS before each CREATE TRIGGER', () => {
  assert.doesNotMatch(sql, /CREATE TABLE (?!IF NOT EXISTS)/)
  assert.doesNotMatch(sql, /CREATE FUNCTION/)
  assert.doesNotMatch(sql, /CREATE INDEX (?!IF NOT EXISTS)/)
  const triggers = [...sql.matchAll(/CREATE TRIGGER (\w+) /g)].map((m) => m[1])
  assert.ok(triggers.length >= 2)
  for (const name of triggers) {
    assert.match(sql, new RegExp(`DROP TRIGGER IF EXISTS ${name} ON public\\.trip_request_revisions;`), `${name} must be dropped first`)
  }
})

test('an amendment emits trip_request_amended with the revision and totals', () => {
  assert.match(fn, /INSERT INTO public\.domain_events \(event_type, aggregate_type, aggregate_id, payload\)\s+VALUES \('trip_request_amended', 'trip_request', r\.id/)
  for (const key of ['revision_number', 'previous_total', 'new_total', 'difference', 'actor']) {
    assert.match(fn, new RegExp(`'${key}'`), `event payload must carry ${key}`)
  }
})
