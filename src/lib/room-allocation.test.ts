// Run with:  npx tsx --test src/lib/room-allocation.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ROOM_CAPACITY,
  allocationCost,
  authoritativeNightlyRates,
  recommendRooms,
  roomTypeOptions,
  validateAllocations,
} from './room-allocation'
import type { RoomPriceInput } from './pricing'
import type { AccommodationSeasonalRate } from './types'

const CHECK_IN = '2026-10-10'

function acc(
  single: number, double: number, triple: number, seasonal: AccommodationSeasonalRate[] = [],
): RoomPriceInput {
  return {
    price_single_room: single,
    price_double_room: double,
    price_triple_room: triple,
    seasonal_rates: seasonal,
  }
}

function season(start: string, end: string, single: number, double: number, triple: number): AccommodationSeasonalRate {
  return {
    id: 's', accommodation_id: 'a', name: 'Peak', start_date: start, end_date: end,
    single_price: single, double_price: double, triple_price: triple, is_active: true,
  }
}

function rec(a: RoomPriceInput, people: number, nights = 1, upgrade = 0) {
  return recommendRooms(people, roomTypeOptions(a, CHECK_IN, nights, upgrade))
}

function shape(r: ReturnType<typeof rec>) {
  return r ? r.allocations.map((x) => `${x.count}${x.type[0]}`).join('+') : null
}

test('constants: capacities', () => {
  assert.deepEqual(ROOM_CAPACITY, { single: 1, double: 2, triple: 3 })
})

test('3 adults: double 1000, single 700, triple 1300 -> one triple, not two doubles', () => {
  const r = rec(acc(700, 1000, 1300), 3)
  assert.equal(shape(r), '1t')
  assert.equal(r?.accommodation_total, 1300)
  assert.equal(r?.rooms, 1)
  assert.equal(r?.capacity, 3)
})

test('(a) all three priced, 1..7 travellers', () => {
  const a = acc(700, 1000, 1300)
  // 1: single 700. 2: double 1000. 3: triple 1300. 4: 2d 2000 vs t+s 2000 vs 4s 2800 -> tie -> larger first (t+s)?
  assert.equal(shape(rec(a, 1)), '1s')
  assert.equal(shape(rec(a, 2)), '1d')
  assert.equal(shape(rec(a, 3)), '1t')
  // 4: 2 doubles = 2000, triple+single = 2000, equal rooms (2) and spare 0 -> larger types first
  const four = rec(a, 4)
  assert.equal(four?.accommodation_total, 2000)
  assert.equal(shape(four), '1s+1t')
  // 5: triple + double = 2300
  assert.equal(shape(rec(a, 5)), '1d+1t')
  assert.equal(rec(a, 5)?.accommodation_total, 2300)
  // 6: two triples 2600 (vs 3 doubles 3000)
  assert.equal(shape(rec(a, 6)), '2t')
  // 7: two triples + single = 3300; triple + 2 doubles = 3300 (3 rooms both) -> larger first
  const seven = rec(a, 7)
  assert.equal(seven?.accommodation_total, 3300)
  assert.equal(seven?.rooms, 3)
  assert.equal(shape(seven), '1s+2t')
})

test('(b) triple unpriced (0): no triple is ever recommended, no 1.5x fallback', () => {
  const a = acc(700, 1000, 0)
  const options = roomTypeOptions(a, CHECK_IN, 2)
  const triple = options.find((o) => o.type === 'triple')
  assert.equal(triple?.available, false)
  assert.equal(triple?.stay_total_per_room, null)
  assert.equal(shape(rec(a, 3)), '1s+1d') // 1700, never a 1500 invented triple
  assert.equal(rec(a, 3)?.accommodation_total, 1700)
  for (let people = 1; people <= 7; people++) {
    assert.ok(!rec(a, people)?.allocations.some((x) => x.type === 'triple'))
  }
})

test('(c) single unpriced: odd parties get an honest double + double', () => {
  const a = acc(0, 1000, 1300)
  assert.equal(shape(rec(a, 1)), '1d') // a lone guest takes a double (only valid priced option)
  assert.equal(shape(rec(a, 2)), '1d')
  assert.equal(shape(rec(a, 3)), '1t')
  assert.equal(shape(rec(a, 4)), '2d')
  assert.equal(rec(a, 4)?.accommodation_total, 2000)
})

test('(d) only double priced: 3 adults -> 2 doubles is the honest minimum', () => {
  const a = acc(0, 1000, 0)
  const three = rec(a, 3)
  assert.equal(shape(three), '2d')
  assert.equal(three?.accommodation_total, 2000)
  assert.equal(three?.capacity, 4)
  assert.equal(shape(rec(a, 1)), '1d')
  assert.equal(shape(rec(a, 5)), '3d')
})

test('(e) nothing priced -> null', () => {
  const a = acc(0, 0, 0)
  for (let people = 1; people <= 7; people++) assert.equal(rec(a, people), null)
  assert.equal(recommendRooms(0, roomTypeOptions(acc(700, 1000, 1300), CHECK_IN, 1)), null)
  assert.equal(recommendRooms(-2, roomTypeOptions(acc(700, 1000, 1300), CHECK_IN, 1)), null)
})

test('(f) seasonal triple 0 for one night and base triple 0 -> triple unavailable', () => {
  // Night 1 (10-10) has a seasonal triple, night 2 (10-11) falls into a season with triple 0 and base is 0.
  const a = acc(700, 1000, 0, [
    season('2026-10-10', '2026-10-10', 800, 1100, 1500),
    season('2026-10-11', '2026-10-11', 800, 1100, 0),
  ])
  assert.equal(authoritativeNightlyRates(a, 'triple', CHECK_IN, 2), null)
  assert.equal(roomTypeOptions(a, CHECK_IN, 2).find((o) => o.type === 'triple')?.available, false)
})

test('(f) seasonal triple > 0 for all nights with base 0 -> triple available', () => {
  const a = acc(700, 1000, 0, [season('2026-10-10', '2026-10-12', 800, 1100, 1500)])
  assert.deepEqual(authoritativeNightlyRates(a, 'triple', CHECK_IN, 3), [1500, 1500, 1500])
  const triple = roomTypeOptions(a, CHECK_IN, 3).find((o) => o.type === 'triple')
  assert.equal(triple?.available, true)
  assert.equal(triple?.stay_total_per_room, 4500)
})

test('seasonal rate wins per night, base fills the gaps, inactive seasons ignored', () => {
  const inactive = { ...season('2026-10-11', '2026-10-11', 1, 1, 1), is_active: false }
  const a = acc(700, 1000, 1300, [season('2026-10-10', '2026-10-10', 800, 1100, 1500), inactive])
  assert.deepEqual(authoritativeNightlyRates(a, 'double', CHECK_IN, 3), [1100, 1000, 1000])
  assert.deepEqual(authoritativeNightlyRates(a, 'single', CHECK_IN, 1), [800])
})

test('non-finite or non-positive rates are never authoritative; zero nights is not priced', () => {
  assert.equal(authoritativeNightlyRates(acc(700, Number.NaN, 0), 'double', CHECK_IN, 1), null)
  assert.equal(authoritativeNightlyRates(acc(700, -5, 0), 'double', CHECK_IN, 1), null)
  assert.equal(authoritativeNightlyRates(acc(700, 1000, 0), 'double', CHECK_IN, 0), null)
})

test('(g) upgrade supplement is per room per night and favours fewer rooms', () => {
  // Without an upgrade 2 singles (2 x 600 = 1200) beat 1 double (1300).
  const a = acc(600, 1300, 0)
  assert.equal(shape(rec(a, 2)), '2s')
  // With +200/room/night over 2 nights: 2 singles = 2 x (1200 + 400) = 3200; double = 2600 + 400 = 3000.
  const withUpgrade = rec(a, 2, 2, 200)
  assert.equal(shape(withUpgrade), '1d')
  assert.equal(withUpgrade?.accommodation_total, 3000)
  const options = roomTypeOptions(a, CHECK_IN, 2, 200)
  assert.equal(options.find((o) => o.type === 'single')?.stay_total_per_room, 1600)
  assert.equal(options.find((o) => o.type === 'double')?.stay_total_per_room, 3000)
})

test('(h) price ties prefer fewer rooms, then less spare capacity', () => {
  // 2 people: 2 singles (2 x 500) tie with 1 double (1000) -> fewer rooms.
  assert.equal(shape(rec(acc(500, 1000, 0), 2)), '1d')
  // 3 people: single+double 1500 ties with triple 1500 -> fewer rooms (triple).
  assert.equal(shape(rec(acc(500, 1000, 1500), 3)), '1t')
  // 1 person: single 1000 ties with double 1000 -> less spare capacity (single).
  assert.equal(shape(rec(acc(1000, 1000, 0), 1)), '1s')
})

test('never sells an empty room and never exceeds the party', () => {
  // Doubles are far cheaper than singles; 3 people still must not exceed 3 rooms and stay minimal.
  const r = rec(acc(5000, 100, 0), 3)
  assert.equal(shape(r), '2d')
  assert.ok((r?.rooms ?? 0) <= 3)
})

test('allocationCost sums priced allocations and is null for an unavailable type', () => {
  const options = roomTypeOptions(acc(700, 1000, 0), CHECK_IN, 2)
  assert.equal(allocationCost([{ type: 'double', count: 2 }, { type: 'single', count: 1 }], options), 5400)
  assert.equal(allocationCost([{ type: 'triple', count: 1 }], options), null)
  assert.equal(allocationCost([], options), 0)
})

test('validateAllocations: unavailable type, capacity, rooms exceed guests', () => {
  const options = roomTypeOptions(acc(700, 1000, 0), CHECK_IN, 1)
  const check = (people: number, allocations: { type: 'single' | 'double' | 'triple'; count: number }[]) =>
    validateAllocations(people, allocations, options)
  assert.deepEqual(check(3, [{ type: 'double', count: 1 }, { type: 'single', count: 1 }]), { ok: true })
  assert.deepEqual(check(3, [{ type: 'triple', count: 1 }]), { ok: false, code: 'ROOM_TYPE_UNAVAILABLE' })
  assert.deepEqual(check(3, [{ type: 'double', count: 1 }]), { ok: false, code: 'ROOM_CAPACITY_EXCEEDED' })
  assert.deepEqual(check(3, [{ type: 'single', count: 4 }]), { ok: false, code: 'ROOMS_EXCEED_GUESTS' })
  // Unavailable beats capacity: nothing can be priced in the first place.
  assert.deepEqual(check(9, [{ type: 'triple', count: 1 }]), { ok: false, code: 'ROOM_TYPE_UNAVAILABLE' })
})
