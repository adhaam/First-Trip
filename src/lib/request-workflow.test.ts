import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  STATUSES,
  TRANSITIONS,
  WorkflowError,
  allowedNextStatuses,
  assertTransition,
  canTransition,
  requiresConfirmedAvailability,
  type RequestDomain,
} from './request-workflow'

const migrationPaths = [
  '../../supabase/migrations/004_weemap_pricing_engine_v2.sql',
  '../../supabase/migrations/013_unified_commerce_foundation.sql',
  '../../supabase/migrations/018_signature_experiences.sql',
  '../../supabase/migrations/031_request_workflow_history_events.sql',
  '../../supabase/migrations/032_trip_requests.sql',
]
const migrations = migrationPaths.map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))

function quotedStatuses(source: string) {
  return [...source.matchAll(/'([a-z]+(?:_[a-z]+)*)'/g)].map((match) => match[1])
}

function latestStatuses(table: string, constraint?: string): string[] {
  let result: string[] | null = null
  for (const sql of migrations) {
    const subject = constraint
      ? new RegExp(`ADD CONSTRAINT ${constraint}([\\s\\S]*?)(?=;|\\n\\s*ALTER TABLE|$)`, 'g')
      : new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'g')
    const patterns = [
      /CHECK\s*\(status\s+IN\s*\(([^)]*)\)\)/g,
      /CHECK\s*\(status\s*=\s*ANY\s*\(ARRAY\[([^\]]*)\]\)\)/g,
    ]
    for (const section of sql.matchAll(subject)) for (const pattern of patterns) {
      for (const match of section[1].matchAll(pattern)) result = quotedStatuses(match[1])
    }
  }
  assert.ok(result, `Could not parse ${constraint ?? table} status CHECK`)
  return result
}

const statusSources: Record<RequestDomain, { table: string, constraint?: string }> = {
  accommodation_booking: { table: 'bookings', constraint: 'bookings_status_check' },
  trip_booking: { table: 'trip_bookings', constraint: 'trip_bookings_status_check' },
  signature_request: { table: 'experience_bookings', constraint: 'experience_bookings_status_check' },
  trip_request: { table: 'trip_requests' },
  commerce_order: { table: 'commerce_orders' },
  rental_reservation: { table: 'rental_reservations' },
}

test('STATUSES exactly match the latest database CHECK lists', () => {
  for (const domain of Object.keys(STATUSES) as RequestDomain[]) {
    const { table, constraint } = statusSources[domain]
    assert.deepEqual(STATUSES[domain], latestStatuses(table, constraint), domain)
  }
})

test('request workflow supports the standard availability and payment path', () => {
  const path = ['new', 'checking_availability', 'awaiting_payment', 'confirmed', 'completed']
  for (let index = 1; index < path.length; index++) {
    assert.equal(canTransition('trip_request', path[index - 1], path[index]), true)
  }
  assert.equal(requiresConfirmedAvailability('awaiting_payment'), true)
  assert.equal(requiresConfirmedAvailability('confirmed'), true)
  assert.equal(requiresConfirmedAvailability('checking_availability'), false)
})

test('invalid jumps are rejected with a typed workflow error', () => {
  assert.equal(canTransition('trip_request', 'new', 'completed'), false)
  assert.equal(canTransition('trip_request', 'cancelled', 'confirmed'), false)
  assert.throws(() => assertTransition('trip_request', 'new', 'completed'), (error: unknown) =>
    error instanceof WorkflowError && error.code === 'invalid_transition',
  )
})

test('reopening cancelled requests and correcting completed requests are explicit paths', () => {
  assert.equal(canTransition('accommodation_booking', 'cancelled', 'new'), true)
  assert.equal(canTransition('rental_reservation', 'cancelled', 'requested'), true)
  assert.equal(canTransition('commerce_order', 'completed', 'confirmed'), true)
})

test('allowedNextStatuses is exactly canTransition over every status pair', () => {
  for (const domain of Object.keys(STATUSES) as RequestDomain[]) {
    for (const from of STATUSES[domain]) {
      const allowed = allowedNextStatuses(domain, from)
      for (const to of STATUSES[domain]) {
        assert.equal(allowed.includes(to), canTransition(domain, from, to), `${domain}: ${from} -> ${to}`)
      }
      assert.deepEqual(allowed, [from, ...(TRANSITIONS[domain][from] ?? [])])
    }
  }
})

test('pickup orders go ready → completed and are never out for delivery', () => {
  const pickup = { fulfillmentMethod: 'pickup' }
  assert.equal(canTransition('commerce_order', 'ready', 'completed', pickup), true)
  assert.equal(canTransition('commerce_order', 'ready', 'out_for_delivery', pickup), false)
  for (const from of STATUSES.commerce_order) {
    if (from !== 'out_for_delivery') {
      assert.equal(canTransition('commerce_order', from, 'out_for_delivery', pickup), false, `pickup ${from}`)
    }
  }
  assert.deepEqual(allowedNextStatuses('commerce_order', 'ready', pickup), ['ready', 'completed', 'cancelled'])
})

test('delivery orders keep ready → out_for_delivery → completed and cannot skip delivery', () => {
  for (const delivery of [{ fulfillmentMethod: 'delivery' }, undefined]) {
    assert.equal(canTransition('commerce_order', 'ready', 'out_for_delivery', delivery), true)
    assert.equal(canTransition('commerce_order', 'out_for_delivery', 'completed', delivery), true)
    assert.equal(canTransition('commerce_order', 'ready', 'completed', delivery), false)
  }
  assert.throws(() => assertTransition('commerce_order', 'ready', 'completed', { fulfillmentMethod: 'delivery' }))
})

test('the commerce graph matches weemap_commerce_order_next() in migration 039', () => {
  const sql = readFileSync(
    new URL('../../supabase/migrations/039_commerce_workflow_integrity.sql', import.meta.url), 'utf8',
  )
  const body = sql.slice(sql.indexOf('FUNCTION public.weemap_commerce_order_next'), sql.indexOf('$$;'))
  const list = (text: string) => [...text.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
  for (const method of ['pickup', 'delivery'] as const) {
    for (const from of STATUSES.commerce_order) {
      const branch = body.split(new RegExp(`WHEN '${from}'\\s+THEN`))[1]?.split(/\n {4}WHEN '|\n {4}ELSE ARRAY/)[0] ?? ''
      const expected = /p_method = 'pickup'/.test(branch)
        ? list(branch.split('ELSE')[method === 'pickup' ? 0 : 1].replace(/p_method = 'pickup'/, ''))
        : list(branch)
      const actual = allowedNextStatuses('commerce_order', from, { fulfillmentMethod: method }).slice(1)
      assert.deepEqual(actual, expected, `${method}: ${from}`)
    }
  }
})
