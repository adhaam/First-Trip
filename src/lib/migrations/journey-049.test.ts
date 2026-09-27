import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Static assertions on the raw SQL text of migration 049 — no database
// required. Checks the contract points that are easy to silently break in a
// future edit: the component_of_journey guard in both booking branches, the
// backfill predicate's use of NOT EXISTS payment_records / child amount_paid,
// that nothing in the migration writes to payment_records, and that
// ops_work_items appends journey_component/converted last.

const sql = readFileSync(
  join(process.cwd(), 'supabase', 'migrations', '049_journey_commercial_ownership.sql'),
  'utf8',
)

test('weemap_record_payment: component_of_journey guards both accommodation_booking and trip_booking branches', () => {
  // has_trip_request is set true only for those two CASE branches, and the
  // single check right after the row lock applies to both via that flag.
  const accommodationBranch = /WHEN 'accommodation_booking' THEN[\s\S]*?has_trip_request := true;/
  const tripBookingBranch = /WHEN 'trip_booking' THEN[\s\S]*?has_trip_request := true;/
  assert.match(sql, accommodationBranch, 'accommodation_booking branch must set has_trip_request := true')
  assert.match(sql, tripBookingBranch, 'trip_booking branch must set has_trip_request := true')

  const guard = /IF has_trip_request AND cur\.trip_request_id IS NOT NULL THEN\s*\n\s*RAISE EXCEPTION 'component_of_journey' USING ERRCODE = 'check_violation';/
  assert.match(sql, guard, 'component_of_journey must be raised when a journey component is targeted')

  // The guard must run before the direction-specific (received/refunded)
  // branch, so it applies to BOTH directions, not just 'received'.
  const guardIndex = sql.indexOf("RAISE EXCEPTION 'component_of_journey'")
  const directionBranchIndex = sql.indexOf("IF p_direction = 'received' THEN")
  assert.ok(guardIndex > -1 && directionBranchIndex > -1, 'both markers must be present')
  assert.ok(guardIndex < directionBranchIndex, 'component_of_journey guard must precede the received/refunded branch')
})

test('weemap_record_payment: agreed_total IS NULL is refused with journey_not_commercial', () => {
  const guard = /IF p_entity_type = 'trip_request' AND cur\.total IS NULL THEN\s*\n\s*RAISE EXCEPTION 'journey_not_commercial' USING ERRCODE = 'check_violation';/
  assert.match(sql, guard)
})

test('weemap_journey_backfill_class: MANUAL_FINANCIAL_REVIEW uses child amount_paid > 0 and payment_records', () => {
  const fn = sql.slice(
    sql.indexOf('CREATE OR REPLACE FUNCTION public.weemap_journey_backfill_class'),
    sql.indexOf('CREATE OR REPLACE FUNCTION public.weemap_convert_trip_request'),
  )
  assert.ok(fn.length > 0, 'weemap_journey_backfill_class function body must be found')
  assert.match(fn, /COALESCE\(b\.amount_paid, 0\) > 0/)
  assert.match(fn, /COALESCE\(tb\.amount_paid, 0\) > 0/)
  assert.match(fn, /JOIN public\.payment_records pr ON b\.id = pr\.entity_id AND pr\.entity_type = 'accommodation_booking'|JOIN public\.bookings b ON b\.id = pr\.entity_id AND pr\.entity_type = 'accommodation_booking'/)
  assert.match(fn, /JOIN public\.trip_bookings tb ON tb\.id = pr\.entity_id AND pr\.entity_type = 'trip_booking'/)
})

test('backfill (section B) filters converted, agreed_total IS NULL, and classifies via the shared predicate', () => {
  const sectionB = sql.slice(sql.indexOf('-- B. SAFE ZERO-PAID BACKFILL'), sql.indexOf('-- C. EXCEPTIONS'))
  assert.match(sectionB, /converted_booking_id IS NOT NULL AND agreed_total IS NULL/)
  assert.match(sectionB, /public\.weemap_journey_backfill_class\(r\.id\)/)
  assert.match(sectionB, /cls = 'SAFE_AUTO_BACKFILL'/)
  // FAIL CLOSED assertion after the backfill loop.
  assert.match(sectionB, /journey_backfill_predicate_leak/)
})

test('migration never UPDATEs or DELETEs payment_records, or writes child money columns directly', () => {
  // Split into logical statements on blank-adjacent semicolons is fragile for
  // PL/pgSQL bodies, so instead scan line-by-line for banned write shapes
  // outside of comments.
  const lines = sql.split(/\r?\n/)
  for (const line of lines) {
    const code = line.replace(/--.*$/, '')
    assert.doesNotMatch(code, /UPDATE\s+public\.payment_records/i, `must not UPDATE payment_records: "${line}"`)
    assert.doesNotMatch(code, /DELETE\s+FROM\s+public\.payment_records/i, `must not DELETE FROM payment_records: "${line}"`)
  }
  // The only UPDATEs on bookings/trip_bookings money columns anywhere in the
  // file must come from the ORIGINAL 036 weemap_record_payment/convert body
  // reproduced verbatim (dynamic EXECUTE format targeting %I, or the
  // trip_requests table) — never a literal `UPDATE public.bookings SET
  // total_price` / `UPDATE public.trip_bookings SET final_price` outside of
  // that dynamic SQL.
  assert.doesNotMatch(sql, /UPDATE\s+public\.bookings\s+SET\s+total_price/i)
  assert.doesNotMatch(sql, /UPDATE\s+public\.trip_bookings\s+SET\s+(final_price|quoted_price)/i)
})

test('ops_work_items appends journey_component and converted as the last two columns of every branch', () => {
  const view = sql.slice(
    sql.indexOf('CREATE OR REPLACE VIEW public.ops_work_items'),
    sql.indexOf('COMMENT ON VIEW public.ops_work_items'),
  )
  assert.ok(view.length > 0)

  // Each UNION ALL branch's final SELECT list line before FROM/JOIN should
  // end with the two boolean columns, aliased on the trip_requests branch
  // and bare literals elsewhere.
  const journeyComponentCount = (view.match(/journey_component/g) ?? []).length
  const convertedCount = (view.match(/\bAS converted\b/g) ?? []).length
  // 6 branches: accommodation_booking, trip_booking, signature_request,
  // trip_request, commerce_order, edition_request.
  assert.equal(journeyComponentCount, 6, 'journey_component must appear once per branch')
  assert.equal(convertedCount, 6, 'converted must appear once per branch')

  // The trip_request branch must compute converted from converted_booking_id.
  assert.match(view, /\(tr\.converted_booking_id IS NOT NULL\) AS converted/)
})
