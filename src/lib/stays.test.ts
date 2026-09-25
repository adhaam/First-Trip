import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  accommodationTypeCounts,
  activeMealPlans,
  filterAccommodationsByType,
  groupAmenities,
  roomRateRows,
  sortAccommodations,
  startingRoomRate,
} from './stays'
import type { Accommodation, MealPlan } from './types'

function acc(overrides: Partial<Accommodation>): Accommodation {
  return {
    id: overrides.id ?? 'x',
    name_ar: 'اسم',
    name_en: 'Name',
    type: 'hotel',
    description_ar: '',
    description_en: '',
    images: [],
    rating: 0,
    location: '',
    amenities_ar: [],
    amenities_en: [],
    price_per_night: 0,
    price_4day: 0,
    price_5day: 0,
    price_double_room: 0,
    price_single_room: 0,
    price_triple_room: 0,
    meal_plans: [],
    sort_order: 0,
    is_active: true,
    created_at: '2024-01-01',
    ...overrides,
  }
}

// ─── startingRoomRate ───

test('startingRoomRate picks the lowest configured room rate', () => {
  assert.equal(
    startingRoomRate({ price_single_room: 1200, price_double_room: 1800, price_triple_room: 2400, price_per_night: 0 }),
    1200,
  )
})

test('startingRoomRate falls back to price_per_night when no room rate is configured', () => {
  assert.equal(
    startingRoomRate({ price_single_room: 0, price_double_room: 0, price_triple_room: 0, price_per_night: 900 }),
    900,
  )
})

test('startingRoomRate ignores zero/blank rates mixed with real ones', () => {
  assert.equal(
    startingRoomRate({ price_single_room: 0, price_double_room: 1500, price_triple_room: 0, price_per_night: 0 }),
    1500,
  )
})

// ─── filterAccommodationsByType / accommodationTypeCounts ───

test('filterAccommodationsByType returns everything for "all"', () => {
  const list = [acc({ id: '1', type: 'hotel' }), acc({ id: '2', type: 'camp' })]
  assert.equal(filterAccommodationsByType(list, 'all').length, 2)
})

test('filterAccommodationsByType narrows to the requested type', () => {
  const list = [acc({ id: '1', type: 'hotel' }), acc({ id: '2', type: 'camp' }), acc({ id: '3', type: 'camp' })]
  const result = filterAccommodationsByType(list, 'camp')
  assert.deepEqual(result.map((a) => a.id), ['2', '3'])
})

test('accommodationTypeCounts counts each type independently of any active filter', () => {
  const list = [
    acc({ id: '1', type: 'hotel' }),
    acc({ id: '2', type: 'camp' }),
    acc({ id: '3', type: 'camp' }),
    acc({ id: '4', type: 'chalet' }),
  ]
  assert.deepEqual(accommodationTypeCounts(list), { hotel: 1, chalet: 1, camp: 2 })
})

// ─── sortAccommodations ───

test('sortAccommodations "default" preserves incoming (server) order', () => {
  const list = [acc({ id: 'b', price_per_night: 500 }), acc({ id: 'a', price_per_night: 100 })]
  assert.deepEqual(sortAccommodations(list, 'default').map((a) => a.id), ['b', 'a'])
})

test('sortAccommodations "price-asc" orders by startingRoomRate, cheapest first', () => {
  const list = [
    acc({ id: 'mid', price_per_night: 500 }),
    acc({ id: 'cheap', price_per_night: 100 }),
    acc({ id: 'expensive', price_per_night: 900 }),
  ]
  assert.deepEqual(sortAccommodations(list, 'price-asc').map((a) => a.id), ['cheap', 'mid', 'expensive'])
})

test('sortAccommodations "price-desc" reverses that order', () => {
  const list = [
    acc({ id: 'mid', price_per_night: 500 }),
    acc({ id: 'cheap', price_per_night: 100 }),
    acc({ id: 'expensive', price_per_night: 900 }),
  ]
  assert.deepEqual(sortAccommodations(list, 'price-desc').map((a) => a.id), ['expensive', 'mid', 'cheap'])
})

test('sortAccommodations always sorts zero/missing prices last, in both directions', () => {
  const list = [
    acc({ id: 'unpriced', price_per_night: 0 }),
    acc({ id: 'priced', price_per_night: 300 }),
  ]
  assert.deepEqual(sortAccommodations(list, 'price-asc').map((a) => a.id), ['priced', 'unpriced'])
  assert.deepEqual(sortAccommodations(list, 'price-desc').map((a) => a.id), ['priced', 'unpriced'])
})

test('sortAccommodations does not mutate the input array', () => {
  const list = [acc({ id: 'b', price_per_night: 500 }), acc({ id: 'a', price_per_night: 100 })]
  const original = [...list]
  sortAccommodations(list, 'price-asc')
  assert.deepEqual(list, original)
})

// ─── roomRateRows ───

test('roomRateRows derives per-person from per-room for double/triple, and passes single through', () => {
  const rows = roomRateRows({ price_single_room: 1000, price_double_room: 1800, price_triple_room: 2400 })
  assert.deepEqual(rows, [
    { type: 'single', pricePerRoom: 1000, occupancy: 1, pricePerPerson: 1000 },
    { type: 'double', pricePerRoom: 1800, occupancy: 2, pricePerPerson: 900 },
    { type: 'triple', pricePerRoom: 2400, occupancy: 3, pricePerPerson: 800 },
  ])
})

test('roomRateRows omits unconfigured (zero) room types', () => {
  const rows = roomRateRows({ price_single_room: 0, price_double_room: 1800, price_triple_room: 0 })
  assert.deepEqual(rows.map((r) => r.type), ['double'])
})

test('roomRateRows returns an empty list when nothing is configured', () => {
  assert.deepEqual(roomRateRows({ price_single_room: 0, price_double_room: 0, price_triple_room: 0 }), [])
})

// ─── activeMealPlans ───

function mealPlan(overrides: Partial<MealPlan>): MealPlan {
  return {
    key: 'room_only',
    label_ar: 'بدون وجبات',
    label_en: 'Room only',
    price_per_person_per_night: 0,
    is_active: true,
    ...overrides,
  }
}

test('activeMealPlans drops inactive plans and sorts by supplement ascending', () => {
  const plans = [
    mealPlan({ key: 'all_inclusive', price_per_person_per_night: 400 }),
    mealPlan({ key: 'room_only', price_per_person_per_night: 0 }),
    mealPlan({ key: 'half_board', price_per_person_per_night: 200, is_active: false }),
    mealPlan({ key: 'breakfast', price_per_person_per_night: 150 }),
  ]
  assert.deepEqual(activeMealPlans(plans).map((p) => p.key), ['room_only', 'breakfast', 'all_inclusive'])
})

test('activeMealPlans handles undefined gracefully', () => {
  assert.deepEqual(activeMealPlans(undefined), [])
})

// ─── groupAmenities ───

test('groupAmenities buckets known amenities into a fixed, stable group order', () => {
  const groups = groupAmenities(['تكييف', 'حمام سباحة', 'إفطار مجاني', 'حديقة خاصة'])
  assert.deepEqual(groups.map((g) => g.key), ['water', 'comfort', 'food', 'outdoor'])
})

test('groupAmenities keeps items within their group in the given order', () => {
  const groups = groupAmenities(['Sea View', 'Beachfront', 'Swimming Pool'])
  assert.deepEqual(groups, [{ key: 'water', items: ['Sea View', 'Beachfront', 'Swimming Pool'] }])
})

test('groupAmenities puts unrecognised strings under "other" instead of dropping them', () => {
  const groups = groupAmenities(['Rooftop cinema'])
  assert.deepEqual(groups, [{ key: 'other', items: ['Rooftop cinema'] }])
})

test('groupAmenities omits empty groups entirely', () => {
  const groups = groupAmenities(['حمام سباحة'])
  assert.deepEqual(groups.map((g) => g.key), ['water'])
})

test('groupAmenities returns [] for an empty list', () => {
  assert.deepEqual(groupAmenities([]), [])
})
