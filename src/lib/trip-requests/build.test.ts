import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { DEFAULT_PAYMENT_POLICIES, paymentPlanForParts } from '@/lib/payment-rules'
import { DEFAULT_TRANSPORT_SCHEDULE } from '@/lib/transport'
import type { PriceSnapshot } from '@/lib/types'
import { buildTripRequestRow, resolveJourneyDates, toQuoteRequest, tripRequestPaymentParts } from './build'
import { tripRequestSchema, type TripRequestInput } from './schema'

const baseContact = { name: 'Nour Ahmed', phone: '01012345678' }

function parseInput(overrides: Record<string, unknown>): TripRequestInput {
  const result = tripRequestSchema.safeParse({ contact: baseContact, ...overrides })
  assert.equal(result.success, true, JSON.stringify(!result.success && result.error.flatten()))
  if (!result.success) throw new Error('unreachable')
  return result.data
}

// ─── resolveJourneyDates ───

test('resolves the package_bus 4-day pattern from its Thursday departure', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'package_bus', origin_governorate_code: 'CAI',
    stay_pattern_code: 'bus_4d3n', arrival_date: '2026-10-01', adults: 2,
  })
  const result = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.dates, { arrivalDate: '2026-10-01', departureDate: '2026-10-05', nights: 3, durationDays: 4 })
})

test('resolves the hiace 5-day pattern from a Tuesday departure (on-demand, any weekday)', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'hiace', origin_governorate_code: 'CAI',
    stay_pattern_code: 'hiace_5d4n', arrival_date: '2026-10-06', adults: 2,
  })
  const result = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.dates, { arrivalDate: '2026-10-06', departureDate: '2026-10-11', nights: 4, durationDays: 5 })
})

test('rejects the bus 4-day pattern on a non-Thursday departure', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'package_bus', origin_governorate_code: 'CAI',
    stay_pattern_code: 'bus_4d3n', arrival_date: '2026-10-06', adults: 2,
  })
  const result = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(result.ok, false)
  if (result.ok) return
  assert.equal(result.code, 'SCHEDULE_INVALID_DEPARTURE_WEEKDAY')
})

test('resolves stay_only dates as-is (never inventing itinerary days)', () => {
  const input = parseInput({
    locale: 'en', transport_mode: 'stay_only', arrival_date: '2026-10-10', departure_date: '2026-10-13',
    adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
  })
  const result = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.deepEqual(result.dates, { arrivalDate: '2026-10-10', departureDate: '2026-10-13', nights: 3, durationDays: 4 })
})

// ─── toQuoteRequest ───

test('maps transport + a chosen stay to a package quote request', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'package_bus', origin_governorate_code: 'CAI', stay_pattern_code: 'bus_4d3n',
    arrival_date: '2026-10-01', adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
    experiences: [{ kind: 'trip', id: '22222222-2222-2222-2222-222222222222' }, { kind: 'trip_package', id: '33333333-3333-3333-3333-333333333333' }],
  })
  const dates = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(dates.ok, true)
  if (!dates.ok) return
  const quoteRequest = toQuoteRequest(input, dates.dates)
  assert.equal(quoteRequest.booking_type, 'package')
  assert.equal(quoteRequest.duration, 4)
  assert.equal(quoteRequest.transfer_type, 'package_bus')
  assert.equal(quoteRequest.transfer_direction, 'round_trip')
  assert.equal(quoteRequest.governorate, 'CAI')
  assert.equal(quoteRequest.accommodation_id, '11111111-1111-1111-1111-111111111111')
  assert.equal(quoteRequest.start_date, '2026-10-01')
  assert.equal(quoteRequest.num_people, 2)
  assert.deepEqual(quoteRequest.extra_trip_ids, ['22222222-2222-2222-2222-222222222222'])
  assert.deepEqual(quoteRequest.trip_package_ids, ['33333333-3333-3333-3333-333333333333'])
})

test('maps stay_only to an accommodation-only quote request', () => {
  const input = parseInput({
    locale: 'en', transport_mode: 'stay_only', arrival_date: '2026-10-10', departure_date: '2026-10-13',
    adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
  })
  const dates = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(dates.ok, true)
  if (!dates.ok) return
  const quoteRequest = toQuoteRequest(input, dates.dates)
  assert.equal(quoteRequest.booking_type, 'accommodation-only')
  assert.equal(quoteRequest.nights, 3)
  assert.equal(quoteRequest.accommodation_id, '11111111-1111-1111-1111-111111111111')
  assert.equal(quoteRequest.transfer_type, undefined)
})

test('maps a transport mode with no accommodation to a round-trip transfer-only quote request', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'hiace', origin_governorate_code: 'CAI', stay_pattern_code: 'hiace_4d3n',
    arrival_date: '2026-10-08', adults: 3,
  })
  const dates = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(dates.ok, true)
  if (!dates.ok) return
  const quoteRequest = toQuoteRequest(input, dates.dates)
  assert.equal(quoteRequest.booking_type, 'transfer-only')
  assert.equal(quoteRequest.transfer_type, 'hiace')
  assert.equal(quoteRequest.transfer_direction, 'round_trip')
  assert.equal(quoteRequest.governorate, 'CAI')
  assert.equal(quoteRequest.accommodation_id, undefined)
})

// ─── buildTripRequestRow matches migration 032 ───

function tripRequestColumns(): string[] {
  const sql = readFileSync(new URL('../../../supabase/migrations/032_trip_requests.sql', import.meta.url), 'utf8')
  const match = sql.match(/CREATE TABLE IF NOT EXISTS public\.trip_requests\s*\(([\s\S]*?)\n\);/)
  assert.ok(match, 'Could not find the trip_requests table definition')
  const body = match![1]
  const columns: string[] = []
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim()
    if (!line || /^(CONSTRAINT|--)/i.test(line)) continue
    const columnMatch = line.match(/^([a-z_]+)\s+(UUID|TEXT|SMALLINT|INTEGER|JSONB|NUMERIC|TIMESTAMPTZ|DATE|BOOLEAN)\b/i)
    if (columnMatch) columns.push(columnMatch[1])
  }
  return columns
}

// Columns the DB fills itself — never part of the INSERT payload.
const GENERATED_COLUMNS = new Set([
  'id', 'reference', 'status', 'converted_booking_id',
  'submitted_at', 'confirmed_at', 'cancelled_at', 'created_at', 'updated_at',
])

test('buildTripRequestRow sets exactly the insertable trip_requests columns', () => {
  const allColumns = tripRequestColumns()
  assert.ok(allColumns.includes('quote_snapshot'), 'sanity check: migration parsing found the expected columns')

  const input = parseInput({
    locale: 'ar', transport_mode: 'package_bus', origin_governorate_code: 'CAI', stay_pattern_code: 'bus_4d3n',
    arrival_date: '2026-10-01', adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
  })
  const dates = resolveJourneyDates(input, DEFAULT_TRANSPORT_SCHEDULE)
  assert.equal(dates.ok, true)
  if (!dates.ok) return

  const snapshot: PriceSnapshot = { total: 4000, num_people: 2, computed_at: '2026-09-25T00:00:00.000Z' }
  const quote = {
    ok: true as const,
    response: {},
    lines: [],
    numPeople: 2,
    perPerson: 2000,
    total: 4000,
    isPriced: true,
    snapshot,
  }
  const paymentPlan = paymentPlanForParts([{ kind: 'stay_package' as const, total: 4000 }], DEFAULT_PAYMENT_POLICIES)

  const row = buildTripRequestRow(input, dates.dates, quote, paymentPlan, 'cust-1')

  const expectedInsertable = allColumns.filter((column) => !GENERATED_COLUMNS.has(column)).sort()
  assert.deepEqual(Object.keys(row).sort(), expectedInsertable)
  assert.equal(row.quoted_total, 4000)
  assert.equal(row.customer_id, 'cust-1')
  assert.equal(row.customer_name, 'Nour Ahmed')
})

// ─── tripRequestPaymentParts ───

test('a Dahab stay package + an experience package + a standalone trip: 50/50 stay-package part, 100% upfront for the rest', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'package_bus', origin_governorate_code: 'CAI', stay_pattern_code: 'bus_4d3n',
    arrival_date: '2026-10-01', adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
    experiences: [
      { kind: 'trip_package', id: '33333333-3333-3333-3333-333333333333' },
      { kind: 'trip', id: '22222222-2222-2222-2222-222222222222' },
    ],
  })

  const snapshot: PriceSnapshot = {
    total: 6800,
    num_people: 2,
    computed_at: '2026-09-25T00:00:00.000Z',
    extra_trips: [{ trip_id: '22222222-2222-2222-2222-222222222222', name_en: 'Blue Hole', price: 500 }],
    trip_packages: [{ package_id: '33333333-3333-3333-3333-333333333333', name_en: 'Sinai Bundle', trip_names_en: [], total: 1800 }],
  }

  const parts = tripRequestPaymentParts(input, { total: 6800, snapshot }, { '33333333-3333-3333-3333-333333333333': 'experience_package' })
  assert.deepEqual(parts, [
    { kind: 'stay_package', total: 4000 }, // 6800 - (500*2) - 1800
    { kind: 'trip', total: 1000 },
    { kind: 'experience_package', total: 1800 },
  ])

  const plan = paymentPlanForParts(parts, DEFAULT_PAYMENT_POLICIES)
  assert.equal(plan.rule, 'policy')
  assert.equal(plan.upfrontAmount, 2000 + 1000 + 1800) // 50% of 4000, 100% of 1000, 100% of 1800
  assert.equal(plan.balanceAmount, 2000) // the remaining 50% of the stay-package part
  assert.equal(plan.upfrontDue, 'after_confirmation')
  assert.equal(plan.payableNow, false)
})

test('stay_only uses the stay payment kind for the whole total', () => {
  const input = parseInput({
    locale: 'en', transport_mode: 'stay_only', arrival_date: '2026-10-10', departure_date: '2026-10-13',
    adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
  })
  const snapshot: PriceSnapshot = { total: 3000, num_people: 2, computed_at: '2026-09-25T00:00:00.000Z' }
  const parts = tripRequestPaymentParts(input, { total: 3000, snapshot })
  assert.deepEqual(parts, [{ kind: 'stay', total: 3000 }])
})

test('stay_only separates trips and experience packages from the 50/50 stay payment part', () => {
  const input = parseInput({
    locale: 'en', transport_mode: 'stay_only', arrival_date: '2026-10-10', departure_date: '2026-10-13',
    adults: 2, accommodation_id: '11111111-1111-1111-1111-111111111111',
    experiences: [
      { kind: 'trip', id: '22222222-2222-2222-2222-222222222222' },
      { kind: 'trip_package', id: '33333333-3333-3333-3333-333333333333' },
    ],
  })
  const snapshot: PriceSnapshot = {
    total: 6800,
    num_people: 2,
    computed_at: '2026-09-25T00:00:00.000Z',
    extra_trips: [{ trip_id: '22222222-2222-2222-2222-222222222222', name_en: 'Blue Hole', price: 500 }],
    trip_packages: [{ package_id: '33333333-3333-3333-3333-333333333333', name_en: 'Sinai Bundle', trip_names_en: [], total: 1800 }],
  }

  const parts = tripRequestPaymentParts(input, { total: 6800, snapshot })
  assert.deepEqual(parts, [
    { kind: 'stay', total: 4000 },
    { kind: 'trip', total: 1000 },
    { kind: 'experience_package', total: 1800 },
  ])

  const plan = paymentPlanForParts(parts, DEFAULT_PAYMENT_POLICIES)
  assert.equal(plan.upfrontAmount, 4800) // 50% of stay + all experiences
  assert.equal(plan.balanceAmount, 2000)
  assert.equal(plan.upfrontDue, 'after_confirmation')
})

test('a transport mode with no accommodation uses the transfer payment kind', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'hiace', origin_governorate_code: 'CAI', stay_pattern_code: 'hiace_4d3n',
    arrival_date: '2026-10-08', adults: 3,
  })
  const snapshot: PriceSnapshot = { total: 1500, num_people: 3, computed_at: '2026-09-25T00:00:00.000Z' }
  const parts = tripRequestPaymentParts(input, { total: 1500, snapshot })
  assert.deepEqual(parts, [{ kind: 'transfer', total: 1500 }])
})

test('transport without a stay separates the trip from the 100% transfer payment part', () => {
  const input = parseInput({
    locale: 'ar', transport_mode: 'hiace', origin_governorate_code: 'CAI', stay_pattern_code: 'hiace_4d3n',
    arrival_date: '2026-10-08', adults: 2,
    experiences: [{ kind: 'trip', id: '22222222-2222-2222-2222-222222222222' }],
  })
  const snapshot: PriceSnapshot = {
    total: 3000,
    num_people: 2,
    computed_at: '2026-09-25T00:00:00.000Z',
    extra_trips: [{ trip_id: '22222222-2222-2222-2222-222222222222', name_en: 'Blue Hole', price: 500 }],
  }

  const parts = tripRequestPaymentParts(input, { total: 3000, snapshot })
  assert.deepEqual(parts, [
    { kind: 'transfer', total: 2000 },
    { kind: 'trip', total: 1000 },
  ])

  const plan = paymentPlanForParts(parts, DEFAULT_PAYMENT_POLICIES)
  assert.equal(plan.upfrontAmount, 3000)
  assert.equal(plan.balanceAmount, 0)
  assert.equal(plan.upfrontDue, 'after_confirmation')
})
