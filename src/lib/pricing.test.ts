// ─── WEEMAP pricing engine tests ───
// Run with:  npx tsx --test src/lib/pricing.test.ts
// (no test framework dependency — uses node:test built into Node 20+)

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  baseNightlyRoomRate,
  resolveNightlyRates,
  accommodationSubtotal,
  includedTripCost,
  quotePackageV2,
  buildPriceSnapshot,
  isPackageDepartureDay,
  isPackageReturnDay,
} from './pricing'
import type { TransferPricing } from './types'

const pricing: TransferPricing = {
  settings: [
    { transfer_type: 'package_bus', name_ar: '', name_en: 'Bus', vehicle_ar: '', vehicle_en: 'Bus', base_price: 400, is_active: true },
    { transfer_type: 'hiace', name_ar: '', name_en: 'Hiace', vehicle_ar: '', vehicle_en: 'Hiace', base_price: 500, is_active: true },
  ],
  governorates: [
    { id: 'g1', transfer_type: 'package_bus', governorate_code: 'cairo', name_ar: '', name_en: 'Cairo', price_surcharge: 0, sort_order: 0, is_active: true },
    { id: 'g2', transfer_type: 'package_bus', governorate_code: 'alexandria', name_ar: '', name_en: 'Alexandria', price_surcharge: 200, sort_order: 1, is_active: true },
    { id: 'g3', transfer_type: 'hiace', governorate_code: 'cairo', name_ar: '', name_en: 'Cairo', price_surcharge: 0, sort_order: 0, is_active: true },
  ],
}

const acc = {
  price_single_room: 1500,
  price_double_room: 2000,
  price_triple_room: 3000,
  seasonal_rates: [
    {
      id: 's1', accommodation_id: 'a1', name: 'High Season',
      start_date: '2026-12-20', end_date: '2027-01-05',
      single_price: 2200, double_price: 3200, triple_price: 4600,
      is_active: true,
    },
  ],
}

test('double room: 2,000 × 3 nights = 6,000 total, 3,000/person', () => {
  const nightly = resolveNightlyRates(acc, 'double', '2026-10-01', 3)
  const total = accommodationSubtotal(nightly)
  assert.equal(total, 6000)
  assert.equal(total / 2, 3000)
})

test('triple room: 3,000 × 3 nights = 9,000 total, 3,000/person', () => {
  const nightly = resolveNightlyRates(acc, 'triple', '2026-10-01', 3)
  const total = accommodationSubtotal(nightly)
  assert.equal(total, 9000)
  assert.equal(total / 3, 3000)
})

test('single room: 1,500 × 3 nights = 4,500 — never half a double', () => {
  const nightly = resolveNightlyRates(acc, 'single', '2026-10-01', 3)
  assert.equal(accommodationSubtotal(nightly), 4500)
})

test('missing triple rate suggests double × 1.5 but stays overridable', () => {
  assert.equal(baseNightlyRoomRate({ price_single_room: 1500, price_double_room: 2000 }, 'triple'), 3000)
  assert.equal(baseNightlyRoomRate(acc, 'triple'), 3000) // explicit value wins
})

test('stay crossing a seasonal boundary is priced night-by-night', () => {
  // 2 nights normal (Dec 18, 19) + 2 nights high season (Dec 20, 21)
  const nightly = resolveNightlyRates(acc, 'double', '2026-12-18', 4)
  assert.deepEqual(nightly.map((n) => n.rate), [2000, 2000, 3200, 3200])
  assert.deepEqual(nightly.map((n) => n.source), ['base', 'base', 'seasonal', 'seasonal'])
  assert.equal(accommodationSubtotal(nightly), 10400)
})

test('included trip uses PACKAGE cost; falls back to public price when unset', () => {
  assert.equal(includedTripCost({ id: 't1', name_en: 'Blue Hole', price: 600, package_price: 400 }), 400)
  assert.equal(includedTripCost({ id: 't2', name_en: 'Canyon', price: 600, package_price: null }), 600)
})

test('package total = room + transfer + 2 included package costs (× people)', () => {
  const quote = quotePackageV2({
    pricing,
    accommodation: acc,
    roomType: 'double',
    checkIn: '2026-10-01',
    nights: 3,
    mealPlanPricePerNight: 0,
    includedTrips: [
      { id: 't1', name_en: 'Blue Hole', price: 600, package_price: 400 },
      { id: 't2', name_en: 'Mt. Sinai', price: 700, package_price: 450 },
    ],
    extraTrips: [],
    transferType: 'package_bus',
    governorateCode: 'cairo',
    direction: 'round_trip',
    numPeople: 2,
  })
  // room 6000 + transfer (400×2 legs×2 ppl = 1600) + trips (850×2 = 1700)
  assert.equal(quote.accommodationSubtotal, 6000)
  assert.equal(quote.transferSubtotal, 1600)
  assert.equal(quote.includedTripsSubtotal, 1700)
  assert.equal(quote.total, 9300)
  assert.equal(quote.perPerson, 4650)
})

test('governorate change (Cairo → Alexandria) changes the transfer price', () => {
  const base = { pricing, accommodation: acc, roomType: 'double' as const, checkIn: '2026-10-01', nights: 3, mealPlanPricePerNight: 0, includedTrips: [], extraTrips: [], transferType: 'package_bus' as const, direction: 'round_trip' as const, numPeople: 2 }
  const cairo = quotePackageV2({ ...base, governorateCode: 'cairo' })
  const alex = quotePackageV2({ ...base, governorateCode: 'alexandria' })
  assert.equal(alex.total - cairo.total, 200 * 2 * 2) // surcharge × legs × people
})

test('transport change (Bus → Hiace) changes the total', () => {
  const base = { pricing, accommodation: acc, roomType: 'double' as const, checkIn: '2026-10-01', nights: 3, mealPlanPricePerNight: 0, includedTrips: [], extraTrips: [], governorateCode: 'cairo', direction: 'round_trip' as const, numPeople: 2 }
  const bus = quotePackageV2({ ...base, transferType: 'package_bus' })
  const hiace = quotePackageV2({ ...base, transferType: 'hiace' })
  assert.equal(hiace.total - bus.total, 100 * 2 * 2)
})

test('bus schedule: Sun/Thu out, Mon/Fri back; Hiace unrestricted', () => {
  assert.equal(isPackageDepartureDay('2026-10-04'), true)  // Sunday
  assert.equal(isPackageDepartureDay('2026-10-06'), false) // Tuesday
  assert.equal(isPackageReturnDay('2026-10-05'), true)     // Monday
  assert.equal(isPackageReturnDay('2026-10-07'), false)    // Wednesday
})

test('meal plan adds price × people × nights', () => {
  const quote = quotePackageV2({
    pricing, accommodation: acc, roomType: 'double', checkIn: '2026-10-01', nights: 3,
    mealPlanPricePerNight: 150, mealPlanKey: 'breakfast',
    includedTrips: [], extraTrips: [],
    transferType: 'package_bus', governorateCode: 'cairo', direction: 'round_trip', numPeople: 2,
  })
  assert.equal(quote.mealSubtotal, 150 * 3 * 2)
})

test('price snapshot freezes the rates used at booking time', () => {
  const input = {
    pricing, accommodation: acc, roomType: 'double' as const, checkIn: '2026-12-18', nights: 4,
    mealPlanPricePerNight: 0,
    includedTrips: [{ id: 't1', name_en: 'Blue Hole', price: 600, package_price: 400 }],
    extraTrips: [{ id: 't3', name_en: 'Safari', price: 500 }],
    transferType: 'package_bus' as const, governorateCode: 'cairo', direction: 'round_trip' as const, numPeople: 2,
  }
  const quote = quotePackageV2(input)
  const snap = buildPriceSnapshot(input, quote)

  assert.equal(snap.total, quote.total)
  assert.equal(snap.nightly_room_rates?.length, 4)
  assert.equal(snap.nightly_room_rates?.[2].source, 'seasonal')
  assert.equal(snap.included_trips?.[0].package_cost, 400)
  assert.equal(snap.extra_trips?.[0].price, 500)

  // Historical safety: mutating live prices does NOT touch the snapshot.
  const frozen = JSON.parse(JSON.stringify(snap))
  acc.price_double_room = 9999
  acc.seasonal_rates[0].double_price = 9999
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), frozen)
  acc.price_double_room = 2000
  acc.seasonal_rates[0].double_price = 3200
})
