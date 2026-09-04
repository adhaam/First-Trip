// ─── Sinai Trip discount tests ───
// Run with:  npx tsx --test src/lib/trip-discounts.test.ts
//
// Covers effectiveTripPrice() — the single resolver every pricing path goes
// through (public trip page, standalone booking, extra trip inside a package,
// admin manual booking) — plus the snapshot that freezes its result.
//
// The contract being defended here (migration 022):
//   * a discount applies to `price` only, never `package_price`
//   * bad config degrades to "no discount", it never throws or goes negative
//   * a resolved price is frozen at booking time and never re-derived

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  effectiveTripPrice,
  buildTripPriceSnapshot,
  extraTripCost,
  includedTripCost,
} from './pricing'

const trip = (over: Record<string, unknown> = {}) => ({
  id: 't1',
  name_en: 'Blue Hole',
  price: 1000,
  package_price: 700,
  ...over,
})

test('no discount configured: the customer pays the public price', () => {
  const priced = effectiveTripPrice(trip())
  assert.equal(priced.final, 1000)
  assert.equal(priced.discountAmount, 0)
  assert.equal(priced.isDiscounted, false)
})

test('percent discount: 10% off 1,000 = 900', () => {
  const priced = effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 10 }))
  assert.equal(priced.original, 1000)
  assert.equal(priced.discountAmount, 100)
  assert.equal(priced.final, 900)
  assert.equal(priced.isDiscounted, true)
})

test('flat discount: 250 off 1,000 = 750', () => {
  const priced = effectiveTripPrice(trip({ discount_type: 'amount', discount_value: 250 }))
  assert.equal(priced.discountAmount, 250)
  assert.equal(priced.final, 750)
})

test('a percentage that does not divide evenly rounds to piastres, so line items still sum', () => {
  // 33% of 999 = 329.67 exactly; the concern is a repeating decimal reaching
  // an invoice and making subtotal != sum(items).
  const priced = effectiveTripPrice(trip({ price: 999, discount_type: 'percentage', discount_value: 33 }))
  assert.equal(priced.discountAmount, 329.67)
  assert.equal(priced.final, 669.33)
  assert.equal(
    Math.round((priced.discountAmount + priced.final) * 100) / 100,
    priced.original,
  )
})

// ─── Invalid config must degrade, never explode ───

test('a flat discount larger than the price clamps to free, never negative', () => {
  const priced = effectiveTripPrice(trip({ price: 500, discount_type: 'amount', discount_value: 900 }))
  assert.equal(priced.final, 0)
  assert.equal(priced.discountAmount, 500)
})

test('a percentage above 100 clamps at 100, never negative', () => {
  const priced = effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 150 }))
  assert.equal(priced.final, 0)
})

test('zero or negative discount value is treated as no discount', () => {
  assert.equal(effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 0 })).final, 1000)
  assert.equal(effectiveTripPrice(trip({ discount_type: 'amount', discount_value: -50 })).final, 1000)
  assert.equal(effectiveTripPrice(trip({ discount_type: 'amount', discount_value: -50 })).isDiscounted, false)
})

test('a garbage discount_type falls back to the public price instead of throwing', () => {
  const priced = effectiveTripPrice(trip({ discount_type: 'buy_one_get_one', discount_value: 50 }))
  assert.equal(priced.final, 1000)
  assert.equal(priced.isDiscounted, false)
})

// ─── Date window ───

const AUG = new Date('2026-08-15T12:00:00Z')

test('a discount scheduled for the future is not applied yet', () => {
  const priced = effectiveTripPrice(
    trip({ discount_type: 'percentage', discount_value: 20, discount_starts_at: '2026-09-01T00:00:00Z' }),
    AUG,
  )
  assert.equal(priced.final, 1000)
  assert.equal(priced.isDiscounted, false)
})

test('an expired discount is not applied', () => {
  const priced = effectiveTripPrice(
    trip({ discount_type: 'percentage', discount_value: 20, discount_ends_at: '2026-08-01T00:00:00Z' }),
    AUG,
  )
  assert.equal(priced.final, 1000)
})

test('a discount inside its window is applied', () => {
  const priced = effectiveTripPrice(
    trip({
      discount_type: 'percentage',
      discount_value: 20,
      discount_starts_at: '2026-08-01T00:00:00Z',
      discount_ends_at: '2026-08-31T00:00:00Z',
    }),
    AUG,
  )
  assert.equal(priced.final, 800)
})

test('an unparseable window boundary is ignored rather than disabling the discount', () => {
  const priced = effectiveTripPrice(
    trip({ discount_type: 'amount', discount_value: 100, discount_ends_at: 'not-a-date' }),
    AUG,
  )
  assert.equal(priced.final, 900)
})

// ─── Interaction with the other trip pricing paths ───

test('the discount never touches package_price: an included trip stays free', () => {
  const discounted = trip({ discount_type: 'percentage', discount_value: 50 })
  assert.equal(includedTripCost(discounted), 0)
})

test('an extra trip added to a package is charged at the discounted public price', () => {
  assert.equal(extraTripCost(trip()), 1000)
  assert.equal(extraTripCost(trip({ discount_type: 'percentage', discount_value: 10 })), 900)
})

// ─── Freezing ───

test('the snapshot records the original, the discount, and the party total', () => {
  const priced = effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 10 }))
  const snap = buildTripPriceSnapshot(priced, 5)

  assert.equal(snap.unit_price_before_discount, 1000)
  assert.equal(snap.discount_per_person, 100)
  assert.equal(snap.discount_type, 'percentage')
  assert.equal(snap.discount_value, 10)
  assert.equal(snap.unit_price, 900)
  assert.equal(snap.num_people, 5)
  assert.equal(snap.total, 4500)
  assert.equal(snap.unit_price * snap.num_people, snap.total)
})

test('a snapshot is inert: changing the trip afterwards cannot move a booked price', () => {
  const atBookingTime = effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 10 }))
  const snap = buildTripPriceSnapshot(atBookingTime, 2)

  // The owner later ends the discount and raises the price.
  const nowMuchLater = effectiveTripPrice(trip({ price: 1500, discount_type: null, discount_value: null }))

  assert.equal(snap.total, 1800)
  assert.notEqual(snap.unit_price, nowMuchLater.final)
})

test('a zero party size is floored to 1 rather than producing a 0 total', () => {
  const snap = buildTripPriceSnapshot(effectiveTripPrice(trip()), 0)
  assert.equal(snap.num_people, 1)
  assert.equal(snap.total, 1000)
})

// ─── Production schema compatibility ───
//
// The DB CHECK constraint on sinai_trips.discount_type allows exactly
// 'amount' | 'percentage', with NULL for "no discount" — the same convention
// Signature Experiences uses. These pin that contract: a 'none' sentinel or
// a 'percent' spelling would be rejected on write by Postgres.

test('the two accepted discount types are the ones the DB constraint allows', () => {
  assert.equal(effectiveTripPrice(trip({ discount_type: 'amount', discount_value: 100 })).isDiscounted, true)
  assert.equal(effectiveTripPrice(trip({ discount_type: 'percentage', discount_value: 10 })).isDiscounted, true)
  // The spellings that would violate the live CHECK constraint.
  assert.equal(effectiveTripPrice(trip({ discount_type: 'percent', discount_value: 10 })).isDiscounted, false)
  assert.equal(effectiveTripPrice(trip({ discount_type: 'none', discount_value: 10 })).isDiscounted, false)
})

test('an undiscounted result reports a NULL type, never a "none" string', () => {
  const priced = effectiveTripPrice(trip())
  assert.equal(priced.discountType, null)
  assert.equal(buildTripPriceSnapshot(priced, 2).discount_type, null)
})

test('the 13 existing production rows (type set, value NULL) read as no discount', () => {
  // Every sinai_trips row already carries discount_type='amount' with a NULL
  // discount_value. That must price as the plain public price, not as free.
  const priced = effectiveTripPrice(trip({ discount_type: 'amount', discount_value: null }))
  assert.equal(priced.final, 1000)
  assert.equal(priced.isDiscounted, false)
})
