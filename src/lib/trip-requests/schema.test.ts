import assert from 'node:assert/strict'
import test from 'node:test'
import { tripRequestSchema } from './schema'

const baseContact = { name: 'Nour Ahmed', phone: '01012345678' }

function stayOnly(overrides: Record<string, unknown> = {}) {
  return {
    locale: 'en',
    transport_mode: 'stay_only',
    arrival_date: '2026-10-10',
    departure_date: '2026-10-13',
    adults: 2,
    accommodation_id: '11111111-1111-1111-1111-111111111111',
    travellers_confirmed: true,
    contact: baseContact,
    ...overrides,
  }
}

function transport(overrides: Record<string, unknown> = {}) {
  return {
    locale: 'ar',
    transport_mode: 'package_bus',
    origin_governorate_code: 'CAI',
    stay_pattern_code: 'bus_4d3n',
    arrival_date: '2026-10-01',
    adults: 2,
    travellers_confirmed: true,
    contact: baseContact,
    ...overrides,
  }
}

test('accepts a minimal valid stay_only request and applies defaults', () => {
  const result = tripRequestSchema.safeParse(stayOnly())
  assert.equal(result.success, true)
  if (!result.success) return
  assert.equal(result.data.source, 'website')
  assert.equal(result.data.builder_stage, 'submitted')
  assert.equal(result.data.children, 0)
  assert.deepEqual(result.data.experiences, [])
})

test('accepts a minimal valid transport request', () => {
  const result = tripRequestSchema.safeParse(transport())
  assert.equal(result.success, true)
})

test('rejects stay_only without an accommodation', () => {
  const input = stayOnly({ accommodation_id: undefined })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'accommodation_id'))
})

test('rejects stay_only without a departure date', () => {
  const input = stayOnly({ departure_date: undefined })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'departure_date'))
})

test('rejects stay_only when departure is not after arrival', () => {
  const input = stayOnly({ departure_date: '2026-10-10' })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'departure_date'))
})

test('rejects a transport mode without an origin governorate', () => {
  const input = transport({ origin_governorate_code: undefined })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'origin_governorate_code'))
})

test('rejects a transport mode without a stay pattern', () => {
  const input = transport({ stay_pattern_code: undefined })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path.join('.') === 'stay_pattern_code'))
})

test('accepts a transport mode with no accommodation (transfer-only)', () => {
  const input = transport({ accommodation_id: undefined })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, true)
})

test('rejects duplicate experience selections', () => {
  const id = '22222222-2222-2222-2222-222222222222'
  const input = transport({ experiences: [{ kind: 'trip', id }, { kind: 'trip', id }] })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
  if (result.success) return
  assert.ok(result.error.issues.some((issue) => issue.path[0] === 'experiences'))
})

test('allows the same id for both a trip and a trip_package (distinct kinds)', () => {
  const id = '22222222-2222-2222-2222-222222222222'
  const input = transport({ experiences: [{ kind: 'trip', id }, { kind: 'trip_package', id }] })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, true)
})

test('rejects more than 10 experiences', () => {
  const experiences = Array.from({ length: 11 }, (_, i) => ({
    kind: 'trip' as const,
    id: `33333333-3333-3333-3333-33333333${String(i).padStart(4, '0')}`,
  }))
  const input = transport({ experiences })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
})

test('rejects an invalid contact email but allows an empty string', () => {
  const bad = tripRequestSchema.safeParse(transport({ contact: { ...baseContact, email: 'not-an-email' } }))
  assert.equal(bad.success, false)
  const empty = tripRequestSchema.safeParse(transport({ contact: { ...baseContact, email: '' } }))
  assert.equal(empty.success, true)
})

test('honeypot and turnstile fields are accepted but optional', () => {
  const result = tripRequestSchema.safeParse(transport({ website: '', turnstile_token: 'abc' }))
  assert.equal(result.success, true)
})

// ─── Custom hiace dates ("Customize" — no stay_pattern_code) ───

test('accepts a custom hiace request with no stay_pattern_code but a later departure_date', () => {
  const input = transport({
    transport_mode: 'hiace', stay_pattern_code: undefined,
    arrival_date: '2026-10-07', departure_date: '2026-10-12',
  })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, true)
})

test('rejects a custom hiace request whose departure_date is not after arrival_date', () => {
  const input = transport({
    transport_mode: 'hiace', stay_pattern_code: undefined,
    arrival_date: '2026-10-07', departure_date: '2026-10-07',
  })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
})

test('rejects a custom hiace request longer than the max nights cap', () => {
  const input = transport({
    transport_mode: 'hiace', stay_pattern_code: undefined,
    arrival_date: '2026-10-07', departure_date: '2026-11-20',
  })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
})

test('rejects a package_bus request without a stay_pattern_code even with a departure_date (custom is hiace-only)', () => {
  const input = transport({
    transport_mode: 'package_bus', stay_pattern_code: undefined,
    arrival_date: '2026-10-07', departure_date: '2026-10-12',
  })
  const result = tripRequestSchema.safeParse(input)
  assert.equal(result.success, false)
})

test('submission rejects travellers that were never explicitly confirmed', () => {
  const missing = tripRequestSchema.safeParse(stayOnly({ travellers_confirmed: undefined }))
  assert.equal(missing.success, false)
  if (!missing.success) assert.ok(missing.error.issues.some((issue) => issue.path[0] === 'travellers_confirmed'))
  assert.equal(tripRequestSchema.safeParse(stayOnly({ travellers_confirmed: false })).success, false)
  assert.equal(tripRequestSchema.safeParse(stayOnly()).success, true)
})
