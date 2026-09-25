// ─── computeQuote characterization tests ───
// Run with:  npx tsx --test src/lib/quote-service.test.ts
//
// Pins the behaviour of the ONE pricing engine used by /api/quote,
// /api/admin/quote, /api/admin/bookings and /api/bookings. Data loading is
// injected (QuoteDataSource), so everything here runs on in-memory fixtures —
// no Supabase.

import test from 'node:test'
import assert from 'node:assert/strict'
import { computeQuote, quoteSchema } from './quote-data'
import { buildBookingRow } from './public-booking'
import type { QuoteDataSource, QuoteInput, QuoteResult } from './quote-data'
import { computePackageTotals } from './pricing'
import type { TripPriceInput } from './pricing'
import type { Accommodation, TransferPricing, TripPackage } from './types'

// ─── Fixtures ───

const NOW = new Date('2026-09-25T10:00:00.000Z')
const COMPUTED_AT = NOW.toISOString()

const ACC_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ACC_ID = '22222222-2222-4222-8222-222222222222'
const LEGACY_ACC_ID = '33333333-3333-4333-8333-333333333333'
const MISSING_ACC_ID = '44444444-4444-4444-8444-444444444444'

const U_SEA = 'aaaaaaaa-0000-4000-8000-000000000001'
const U_OLD = 'aaaaaaaa-0000-4000-8000-000000000002' // inactive
const U_OTHER = 'aaaaaaaa-0000-4000-8000-000000000003' // belongs to another hotel
const U_FAKE = 'aaaaaaaa-0000-4000-8000-00000000ffff'

const T1 = 'bbbbbbbb-0000-4000-8000-000000000001' // 1000, no discount
const T2 = 'bbbbbbbb-0000-4000-8000-000000000002' // 2000, 10% off (open window)
const T3 = 'bbbbbbbb-0000-4000-8000-000000000003' // 1200, discount window expired
const T_INACTIVE = 'bbbbbbbb-0000-4000-8000-000000000004'
const T_FAKE = 'bbbbbbbb-0000-4000-8000-00000000ffff'
const PT1 = 'bbbbbbbb-0000-4000-8000-000000000011'
const PT2 = 'bbbbbbbb-0000-4000-8000-000000000012'

const P1 = 'cccccccc-0000-4000-8000-000000000001'
const P_FAKE = 'cccccccc-0000-4000-8000-00000000ffff'

const pricing: TransferPricing = {
  settings: [
    { transfer_type: 'package_bus', name_ar: '', name_en: 'Bus', vehicle_ar: '', vehicle_en: 'Bus', base_price: 400, is_active: true },
    { transfer_type: 'hiace', name_ar: '', name_en: 'Hiace', vehicle_ar: '', vehicle_en: 'Hiace', base_price: 700, is_active: true },
  ],
  governorates: [
    { id: 'g1', transfer_type: 'package_bus', governorate_code: 'cairo', name_ar: 'القاهرة', name_en: 'Cairo', price_surcharge: 0, sort_order: 0, is_active: true },
    { id: 'g2', transfer_type: 'package_bus', governorate_code: 'alexandria', name_ar: 'الإسكندرية', name_en: 'Alexandria', price_surcharge: 200, sort_order: 1, is_active: true },
    { id: 'g3', transfer_type: 'hiace', governorate_code: 'cairo', name_ar: 'القاهرة', name_en: 'Cairo', price_surcharge: 0, sort_order: 0, is_active: true },
    { id: 'g4', transfer_type: 'hiace', governorate_code: 'alexandria', name_ar: 'الإسكندرية', name_en: 'Alexandria', price_surcharge: 300, sort_order: 1, is_active: true },
  ],
}

const acc = {
  id: ACC_ID,
  name_ar: 'فندق',
  name_en: 'Reef Hotel',
  price_per_night: 0,
  price_4day: 0,
  price_5day: 0,
  price_single_room: 1500,
  price_double_room: 2000,
  price_triple_room: 2700,
  meal_plans: [
    { key: 'breakfast', label_ar: 'إفطار', label_en: 'Breakfast', price_per_person_per_night: 150, is_active: true },
    { key: 'half_board', label_ar: 'نصف إقامة', label_en: 'Half board', price_per_person_per_night: 300, is_active: false },
  ],
  seasonal_rates: [
    {
      id: 's1', accommodation_id: ACC_ID, name: 'Winter Peak',
      start_date: '2026-12-20', end_date: '2026-12-31',
      single_price: 2200, double_price: 3000, triple_price: 4000, is_active: true,
    },
  ],
  room_upgrades: [
    { id: U_SEA, accommodation_id: ACC_ID, name_ar: 'إطلالة بحرية', name_en: 'Sea View', extra_price_per_night: 500, sort_order: 0, is_active: true, created_at: '' },
    { id: U_OLD, accommodation_id: ACC_ID, name_ar: 'قديم', name_en: 'Old Tier', extra_price_per_night: 900, sort_order: 1, is_active: false, created_at: '' },
    { id: U_OTHER, accommodation_id: OTHER_ACC_ID, name_ar: 'آخر', name_en: 'Other Hotel Tier', extra_price_per_night: 400, sort_order: 2, is_active: true, created_at: '' },
  ],
} as unknown as Accommodation

// Legacy property: room columns are NUMERIC strings "0.00" exactly as Supabase
// returns them, flat legacy prices set.
const legacyAcc = {
  id: LEGACY_ACC_ID,
  name_ar: 'قديم',
  name_en: 'Old Camp',
  price_per_night: 800,
  price_4day: 5000,
  price_5day: 6500,
  price_single_room: '0.00',
  price_double_room: '0.00',
  price_triple_room: '0.00',
  meal_plans: [
    { key: 'breakfast', label_ar: 'إفطار', label_en: 'Breakfast', price_per_person_per_night: 150, is_active: true },
  ],
  seasonal_rates: [],
  room_upgrades: [],
} as unknown as Accommodation

const trips: (TripPriceInput & { is_active: boolean })[] = [
  { id: T1, name_en: 'Blue Hole', price: 1000, is_active: true },
  {
    id: T2, name_en: 'Colored Canyon', price: 2000, is_active: true,
    discount_type: 'percentage', discount_value: 10,
    discount_starts_at: '2026-01-01T00:00:00Z', discount_ends_at: '2099-01-01T00:00:00Z',
  },
  {
    id: T3, name_en: 'St Catherine', price: 1200, is_active: true,
    discount_type: 'amount', discount_value: 300,
    discount_starts_at: '2019-01-01T00:00:00Z', discount_ends_at: '2020-01-01T00:00:00Z',
  },
  { id: T_INACTIVE, name_en: 'Retired Trip', price: 800, is_active: false },
]

const packageTrips = [
  { id: PT1, name_en: 'Ras Abu Galum', name_ar: '', price: 900, package_price: 700 },
  { id: PT2, name_en: 'Three Pools', name_ar: '', price: 1100, package_price: 800 },
]
const tripPackages = [
  {
    id: P1, name_en: 'Coast Combo', name_ar: 'كومبو',
    trips: packageTrips,
    totals: computePackageTotals(packageTrips),
  },
] as unknown as TripPackage[]

interface SourceOptions {
  pricing?: TransferPricing
}

/**
 * In-memory stand-in for the Supabase-backed data source. It mirrors the DB
 * queries' filters: active accommodations only, active trip packages only,
 * active sinai_trips only.
 */
function makeSource(opts: SourceOptions = {}): QuoteDataSource & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    async getTransferPricing() {
      calls.push('transfer')
      return opts.pricing ?? pricing
    },
    async getAccommodationById(id) {
      calls.push(`acc:${id}`)
      if (id === ACC_ID) return acc
      if (id === LEGACY_ACC_ID) return legacyAcc
      return null
    },
    async getExtraTrips(ids) {
      calls.push(`trips:${ids.join(',')}`)
      return trips
        .filter((t) => ids.includes(t.id) && t.is_active)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ is_active: _active, ...t }) => t)
    },
    async getTripPackages(ids) {
      calls.push(`packages:${ids.join(',')}`)
      return tripPackages.filter((p) => ids.includes(p.id))
    },
  }
}

async function quote(input: Partial<QuoteInput> & Pick<QuoteInput, 'booking_type' | 'num_people'>, opts: SourceOptions = {}) {
  return computeQuote({ start_date: '2026-10-04', ...input } as QuoteInput, { source: makeSource(opts), now: NOW })
}

function ok(r: QuoteResult) {
  if (!r.ok) assert.fail(`expected a priced quote, got ${r.status} ${r.error}`)
  return r
}

/** Invoices rebuild the total from these snapshot components — they must add up. */
function assertSnapshotSumsToTotal(r: Extract<QuoteResult, { ok: true }>) {
  const s = r.snapshot
  const sum = (s.accommodation_subtotal ?? 0) + (s.transfer_subtotal ?? 0) + (s.meal_subtotal ?? 0)
    + (s.included_trips_subtotal ?? 0) + (s.extra_trips_subtotal ?? 0) + (s.trip_packages_subtotal ?? 0)
  assert.equal(sum, s.total, 'snapshot components must sum to snapshot.total')
  assert.equal(s.total, r.total)
}

// ─── transfer-only ───

test('transfer-only: hiace, surcharge governorate, one way', async () => {
  const r = ok(await quote({
    booking_type: 'transfer-only', transfer_type: 'hiace', transfer_direction: 'to_dahab',
    governorate: 'alexandria', num_people: 3,
  }))
  assert.equal(r.total, 3000) // (700 + 300) × 1 leg × 3
  assert.equal(r.perPerson, 1000)
  assert.equal(r.isPriced, true)
  assert.deepEqual(r.snapshot, {
    transfer_rate_used: 1000, transfer_subtotal: 3000, num_people: 3, total: 3000, computed_at: COMPUTED_AT,
  })
  assert.equal(r.response.total, 3000)
  assert.equal(r.response.is_priced, true)
  assert.deepEqual(r.lines.map((l) => [l.key, l.amount]), [['transfer', 3000]])
})

test('transfer-only: shared bus, Cairo, round trip doubles the leg price', async () => {
  const r = ok(await quote({
    booking_type: 'transfer-only', transfer_type: 'package_bus', transfer_direction: 'round_trip',
    governorate: 'cairo', num_people: 2,
  }))
  assert.equal(r.total, 1600) // 400 × 2 legs × 2
  assertSnapshotSumsToTotal(r)
})

test('transfer-only: from_dahab is a single leg', async () => {
  const r = ok(await quote({
    booking_type: 'transfer-only', transfer_type: 'package_bus', transfer_direction: 'from_dahab',
    governorate: 'alexandria', num_people: 1,
  }))
  assert.equal(r.total, 600)
})

test('transfer-only: defaults to hiace, to_dahab; missing governorate prices at the Cairo base', async () => {
  const r = ok(await quote({ booking_type: 'transfer-only', num_people: 2 }))
  assert.equal(r.total, 1400)
  assert.equal(r.response.transfer_type, 'hiace')
  assert.equal(r.response.direction, 'to_dahab')
})

test('transfer-only: selected extra trips are charged per person and frozen in the snapshot', async () => {
  const r = ok(await quote({
    booking_type: 'transfer-only', transfer_type: 'hiace', transfer_direction: 'to_dahab',
    governorate: 'cairo', extra_trip_ids: [T1], num_people: 2,
  }))
  // transfer 700 × 2; trip 1000 × 2
  assert.equal(r.total, 3400)
  assert.deepEqual(r.snapshot.extra_trips, [{ trip_id: T1, name_en: 'Blue Hole', price: 1000 }])
  assert.equal(r.snapshot.extra_trips_subtotal, 2000)
  assert.deepEqual(r.lines.map((line) => [line.key, line.amount]), [['transfer', 1400], ['extra_trips', 2000]])
  assertSnapshotSumsToTotal(r)
})

// ─── accommodation-only ───

test('stay-only: double room, meal plan, no season', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 3, room_type: 'double', meal_plan_key: 'breakfast', num_people: 2,
  }))
  assert.equal(r.total, 6900) // 2000 × 3 + 150 × 2 × 3
  assert.deepEqual(r.snapshot, {
    room_type: 'double',
    num_rooms: 1,
    nightly_room_rates: [
      { date: '2026-10-10', rate: 2000, source: 'base' },
      { date: '2026-10-11', rate: 2000, source: 'base' },
      { date: '2026-10-12', rate: 2000, source: 'base' },
    ],
    nights: 3,
    accommodation_subtotal: 6000,
    meal_plan_key: 'breakfast',
    meal_plan_price_per_person_per_night: 150,
    meal_subtotal: 900,
    num_people: 2,
    total: 6900,
    computed_at: COMPUTED_AT,
  })
  assertSnapshotSumsToTotal(r)
  assert.deepEqual(r.lines.map((l) => [l.key, l.amount]), [['accommodation', 6000], ['meals', 900]])
})

test('stay-only: single rooms with an upgrade — upgrade folded into accommodation_subtotal', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 2, room_type: 'single', upgrade_id: U_SEA, num_people: 3,
  }))
  // 3 single rooms × 1500 × 2 nights = 9000; upgrade 500 × 3 rooms × 2 nights = 3000
  assert.equal(r.total, 12000)
  assert.equal(r.snapshot.num_rooms, 3)
  assert.equal(r.snapshot.accommodation_subtotal, 12000)
  assert.equal(r.response.accommodation_subtotal, 9000)
  assert.equal(r.response.upgrade_subtotal, 3000)
  assert.deepEqual(r.lines.map((l) => [l.key, l.amount]), [['accommodation', 9000], ['upgrade', 3000]])
  assertSnapshotSumsToTotal(r)
})

test('stay-only: triple rooms priced night-by-night across a seasonal boundary', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-12-18',
    nights: 4, room_type: 'triple', num_people: 4,
  }))
  // 2 rooms × (2700 + 2700 + 4000 + 4000)
  assert.equal(r.total, 26800)
  assert.deepEqual(r.snapshot.nightly_room_rates?.map((n) => n.source), ['base', 'base', 'seasonal', 'seasonal'])
  assert.equal(r.snapshot.nightly_room_rates?.[2].seasonal_rate_name, 'Winter Peak')
})

test('stay-only: room allocations with a per-allocation upgrade (no season)', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 2, meal_plan_key: 'breakfast', num_people: 3,
    room_allocations: [{ type: 'double', count: 1 }, { type: 'single', count: 1, upgrade_id: U_SEA }],
  }))
  // double 2000×2 = 4000; single (1500+500)×2 = 4000; meals 150×3×2 = 900
  assert.equal(r.total, 8900)
  assert.equal(r.snapshot.accommodation_subtotal, 8000)
  assert.equal(r.snapshot.room_allocations?.length, 2)
  assert.equal(r.snapshot.room_allocations?.[1].upgrade_id, U_SEA)
  assert.equal(r.snapshot.room_allocations?.[1].final_nightly_rate, 2000)
  assertSnapshotSumsToTotal(r)
})

test('stay-only legacy: no room pricing ("0.00" strings) uses price_per_night × nights × people', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: LEGACY_ACC_ID, nights: 3, num_people: 2,
  }))
  assert.equal(r.total, 4800)
  assert.equal(r.snapshot.accommodation_subtotal, 4800)
  assertSnapshotSumsToTotal(r)
})

test('stay-only: discounted extra trips and trip packages are charged and itemised', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 2, room_type: 'double', extra_trip_ids: [T2], trip_package_ids: [P1], num_people: 2,
  }))
  // stay 2000 × 2; discounted trip 1800 × 2; package 1500 × 2
  assert.equal(r.total, 10600)
  assert.deepEqual(r.snapshot.extra_trips, [{
    trip_id: T2, name_en: 'Colored Canyon', price: 1800, price_before_discount: 2000, discount_per_person: 200,
  }])
  assert.equal(r.snapshot.extra_trips_subtotal, 3600)
  assert.deepEqual(r.snapshot.trip_packages, [{
    package_id: P1, name_en: 'Coast Combo', trip_names_en: ['Ras Abu Galum', 'Three Pools'], total: 3000,
  }])
  assert.equal(r.snapshot.trip_packages_subtotal, 3000)
  assert.deepEqual(r.lines.map((line) => [line.key, line.amount]), [
    ['accommodation', 4000], ['extra_trips', 3600], ['trip_packages', 3000],
  ])
  assertSnapshotSumsToTotal(r)
})

// ─── package ───

test('package: 4-day, shared bus, double room, Cairo round trip', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: ACC_ID, duration: 4, transfer_type: 'package_bus',
    transfer_direction: 'round_trip', governorate: 'cairo', room_type: 'double', num_people: 2,
  }))
  // 3 nights × 2000 + 400 × 2 legs × 2 people
  assert.equal(r.total, 7600)
  assert.equal(r.snapshot.nights, 3)
  assert.equal(r.snapshot.transfer_rate_used, 800)
  assertSnapshotSumsToTotal(r)
})

test('package: 5-day hiace + meal + upgrade + discounted extra trip + trip package', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: ACC_ID, duration: 5, transfer_type: 'hiace',
    governorate: 'alexandria', room_type: 'triple', upgrade_id: U_SEA, meal_plan_key: 'breakfast',
    extra_trip_ids: [T1, T2], trip_package_ids: [P1], num_people: 2,
  }))
  // room 2700 × 4 = 10800; upgrade 500 × 1 × 4 = 2000; hiace (700+300) × 2 × 2 = 4000;
  // meals 150 × 4 × 2 = 1200; trips (1000 + 1800) × 2 = 5600; package 1500 × 2 = 3000
  assert.equal(r.total, 26600)
  assert.deepEqual(r.snapshot, {
    room_type: 'triple',
    num_rooms: 1,
    nightly_room_rates: [
      { date: '2026-10-04', rate: 2700, source: 'base' },
      { date: '2026-10-05', rate: 2700, source: 'base' },
      { date: '2026-10-06', rate: 2700, source: 'base' },
      { date: '2026-10-07', rate: 2700, source: 'base' },
    ],
    nights: 4,
    accommodation_subtotal: 12800,
    transfer_rate_used: 2000,
    transfer_subtotal: 4000,
    included_trips: [],
    included_trips_subtotal: 0,
    meal_plan_key: 'breakfast',
    meal_plan_price_per_person_per_night: 150,
    meal_subtotal: 1200,
    extra_trips: [
      { trip_id: T1, name_en: 'Blue Hole', price: 1000 },
      { trip_id: T2, name_en: 'Colored Canyon', price: 1800, price_before_discount: 2000, discount_per_person: 200 },
    ],
    extra_trips_subtotal: 5600,
    trip_packages: [{ package_id: P1, name_en: 'Coast Combo', trip_names_en: ['Ras Abu Galum', 'Three Pools'], total: 3000 }],
    trip_packages_subtotal: 3000,
    num_people: 2,
    total: 26600,
    computed_at: COMPUTED_AT,
  })
  assertSnapshotSumsToTotal(r)
  assert.deepEqual(
    r.lines.map((l) => [l.key, l.amount]),
    [['accommodation', 10800], ['upgrade', 2000], ['transfer', 4000], ['meals', 1200], ['extra_trips', 5600], ['trip_packages', 3000]],
  )
})

test('package: uses explicitly resolved 6-day pattern nights', async () => {
  assert.equal(quoteSchema.safeParse({
    booking_type: 'package', accommodation_id: ACC_ID, duration: 6, nights: 5,
    start_date: '2026-10-04', num_people: 2,
  }).success, true)
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: ACC_ID, duration: 6, nights: 5,
    transfer_type: 'hiace', governorate: 'cairo', room_type: 'double', num_people: 2,
  }))
  // 5 nights × 2000 + hiace 700 × 2 legs × 2 people
  assert.equal(r.total, 12800)
  assert.equal(r.snapshot.nights, 5)
})

test('package: defaults to hiace, round trip, 4-day, double', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: ACC_ID, governorate: 'cairo', num_people: 1,
  }))
  // 2000 × 3 + 700 × 2
  assert.equal(r.total, 7400)
  assert.equal(r.response.transfer_type, 'hiace')
})

test('package: room allocations, expired trip discount is not applied', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: ACC_ID, duration: 4, transfer_type: 'package_bus',
    governorate: 'cairo', num_people: 3, extra_trip_ids: [T3],
    room_allocations: [{ type: 'double', count: 1 }, { type: 'single', count: 1 }],
  }))
  // rooms (2000 + 1500) × 3 = 10500; bus 800 × 3 = 2400; T3 1200 × 3 = 3600
  assert.equal(r.total, 16500)
  assert.deepEqual(r.snapshot.extra_trips, [{ trip_id: T3, name_en: 'St Catherine', price: 1200 }])
  assertSnapshotSumsToTotal(r)
})

test('package legacy: flat price_4day + shared bus regardless of requested transport', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: LEGACY_ACC_ID, duration: 4, transfer_type: 'hiace',
    governorate: 'alexandria', num_people: 2,
  }))
  // (5000 + (400 + 200) × 2) × 2
  assert.equal(r.total, 12400)
  assert.equal(r.snapshot.accommodation_subtotal, 10000)
  assert.equal(r.snapshot.transfer_subtotal, 2400)
  assertSnapshotSumsToTotal(r)
})

test('package legacy 5-day uses price_5day', async () => {
  const r = ok(await quote({
    booking_type: 'package', accommodation_id: LEGACY_ACC_ID, duration: 5, governorate: 'cairo', num_people: 1,
  }))
  assert.equal(r.total, 6500 + 800)
})

// ─── rejections that already existed ───

test('rejects: missing accommodation_id (400), unknown accommodation (404)', async () => {
  const a = await quote({ booking_type: 'package', num_people: 2 })
  assert.equal(a.ok, false)
  assert.equal(!a.ok && a.status, 400)
  const b = await quote({ booking_type: 'package', accommodation_id: MISSING_ACC_ID, num_people: 2 })
  assert.equal(!b.ok && b.status, 404)
})

test('rejects: unavailable trip package, and a trip also selected individually', async () => {
  const a = await quote({
    booking_type: 'package', accommodation_id: ACC_ID, governorate: 'cairo', num_people: 2, trip_package_ids: [P_FAKE],
  })
  assert.equal(!a.ok && a.status, 400)
  const b = await quote({
    booking_type: 'package', accommodation_id: ACC_ID, governorate: 'cairo', num_people: 2,
    trip_package_ids: [P1], extra_trip_ids: [PT1],
  })
  assert.equal(!b.ok && b.status, 400)
})

test('inactive or foreign upgrade tiers are never charged', async () => {
  // Pinned before the unknown-upgrade fix: see the rejection tests below for
  // ids that do not belong to the property at all.
  const base = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 1, room_type: 'double', num_people: 2,
  }))
  assert.equal(base.total, 2000)
})

test('the data source is only asked for what the request needs', async () => {
  const src = makeSource()
  await computeQuote(
    { booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10', nights: 1, num_people: 2 },
    { source: src, now: NOW },
  )
  assert.deepEqual(src.calls, [`acc:${ACC_ID}`])
})

// ─── CURRENT DEFECTS (pinned before the fix — flipped in step C) ───

test('allocations use seasonal rates night by night', async () => {
  const r = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-12-19',
    nights: 2, num_people: 3,
    room_allocations: [{ type: 'double', count: 1 }, { type: 'single', count: 1 }],
  }))
  assert.equal(r.total, 2000 + 1500 + 3000 + 2200)
  assert.equal((r.snapshot.room_allocations?.[0] as { nightly_rates?: { source: string }[] }).nightly_rates?.[1].source, 'seasonal')
})

test('rejects room allocations that cannot accommodate the party', async () => {
  const r = await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 1, num_people: 50, room_allocations: [{ type: 'single', count: 1 }],
  })
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.code, 'ROOM_CAPACITY_EXCEEDED')
})

test('rejects unknown or inactive meal plans', async () => {
  for (const key of ['lobster', 'half_board']) {
    const r = await quote({
      booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
      nights: 1, room_type: 'double', meal_plan_key: key, num_people: 2,
    })
    assert.equal(r.ok, false)
    assert.equal(!r.ok && r.code, 'MEAL_PLAN_UNAVAILABLE')
  }
})

test('rejects unavailable governorates and transfer configuration', async () => {
  const a = await quote({ booking_type: 'transfer-only', transfer_type: 'package_bus', governorate: 'mars', num_people: 2 })
  assert.equal(a.ok, false)
  assert.equal(!a.ok && a.code, 'GOVERNORATE_UNAVAILABLE')
  const b = await quote({ booking_type: 'transfer-only', governorate: 'cairo', num_people: 2 }, { pricing: { settings: [], governorates: [] } })
  assert.equal(b.ok, false)
  assert.equal(!b.ok && b.code, 'TRANSFER_NOT_PRICED')
})

test('rejects unavailable upgrades and extra trips', async () => {
  const a = await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 1, room_type: 'double', upgrade_id: U_FAKE, num_people: 2,
  })
  assert.equal(a.ok, false)
  assert.equal(!a.ok && a.code, 'UPGRADE_UNAVAILABLE')
  const b = await quote({
    booking_type: 'package', accommodation_id: ACC_ID, governorate: 'cairo', num_people: 1, extra_trip_ids: [T_FAKE],
  })
  assert.equal(b.ok, false)
  assert.equal(!b.ok && b.code, 'EXTRA_TRIP_UNAVAILABLE')
  const c = await quote({
    booking_type: 'transfer-only', transfer_type: 'hiace', governorate: 'cairo', num_people: 1,
    extra_trip_ids: [T_INACTIVE],
  })
  assert.equal(c.ok, false)
  assert.equal(!c.ok && c.code, 'EXTRA_TRIP_UNAVAILABLE')
})

test('public booking row freezes the quote total and canonical snapshot unchanged', async () => {
  const result = ok(await quote({
    booking_type: 'accommodation-only', accommodation_id: ACC_ID, start_date: '2026-10-10',
    nights: 2, room_type: 'double', meal_plan_key: 'breakfast', num_people: 2,
  }))
  const row = buildBookingRow({
    customer_name: 'Test Customer', customer_phone: '01234567890', booking_type: 'accommodation-only',
    accommodation_id: ACC_ID, trip_date: '2026-10-10', nights: 2, room_type: 'double',
    meal_plan_key: 'breakfast', num_people: 2,
  } as never, result)
  assert.equal(row.total_price, result.total)
  assert.deepEqual(row.price_snapshot, result.snapshot)
})
