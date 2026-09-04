// ─── Invoice line-item builder tests ───
// Run with:  npx tsx --test src/lib/invoice-items.test.ts
//
// These cover the branching that actually produced the reported bug: an
// invoice for a 5-person transfer-only booking that read "Accommodation,
// qty 2" with no party size, no vehicle and no direction anywhere on it.
//
// The invariants defended here:
//   * a transfer-only invoice never charges for, or names, an accommodation
//   * the quantity column carries the real party size for per-person charges
//   * a booking with no price_snapshot still produces an honest invoice
//   * a discount is shown, never silently folded into a lower number

import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAccommodationInvoice, buildTripInvoice } from './invoice-items'
import type { Booking } from './types'

type AccBooking = Parameters<typeof buildAccommodationInvoice>[0]

const booking = (over: Partial<Booking> & Record<string, unknown> = {}): AccBooking => ({
  id: 'b1',
  customer_name: 'Mark',
  customer_phone: '01203503882',
  booking_type: 'package',
  num_people: 2,
  status: 'confirmed',
  created_at: '2026-09-01T00:00:00Z',
  accommodations: null,
  ...over,
}) as AccBooking

const valueOf = (details: { label_en: string; value_en: string }[], label: string) =>
  details.find(d => d.label_en === label)?.value_en

// ─── The reported bug ───

test('transfer-only booking: charges a transfer, never an accommodation', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'transfer-only',
    num_people: 5,
    transfer_type: 'hiace',
    transfer_direction: 'round_trip',
    governorate: 'Cairo',
    total_price: 9500,
    price_snapshot: {
      transfer_rate_used: 1900,
      transfer_subtotal: 9500,
      num_people: 5,
      total: 9500,
      computed_at: '2026-09-01T00:00:00Z',
    },
  }), 'en')

  assert.equal(built.items.length, 1)
  const line = built.items[0]
  assert.match(line.description_en, /Transfer/)
  assert.match(line.description_en, /Private Hiace/)
  assert.match(line.description_en, /Round trip/)
  // No accommodation anywhere in the charges.
  assert.doesNotMatch(line.description_en, /Accommodation/)
  assert.doesNotMatch(line.description_ar, /إقامة/)

  // The quantity column now means "how many people", not "1".
  assert.equal(line.quantity, 5)
  assert.equal(line.unitPrice, 1900)
  assert.equal(line.quantity * line.unitPrice, 9500)
})

test('transfer-only booking: the details block states party size, vehicle and direction', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'transfer-only',
    num_people: 5,
    transfer_type: 'hiace',
    transfer_direction: 'round_trip',
    governorate: 'Cairo',
    total_price: 9500,
  }), 'en')

  assert.equal(valueOf(built.details, 'Booking type'), 'Transfer only')
  assert.equal(valueOf(built.details, 'Number of people'), '5 people')
  assert.equal(valueOf(built.details, 'Transfer type'), 'Private Hiace')
  assert.equal(valueOf(built.details, 'Direction'), 'Round trip')
  assert.equal(valueOf(built.details, 'Governorate'), 'Cairo')
  // Nothing accommodation-shaped on a transfer booking.
  assert.equal(valueOf(built.details, 'Room type'), undefined)
  assert.equal(valueOf(built.details, 'Nights'), undefined)
})

test('transfer-only booking with NO snapshot still avoids the accommodation fallback', () => {
  // This is the exact shape of every manually-entered booking made before
  // the dashboard started computing and storing a price_snapshot.
  const built = buildAccommodationInvoice(booking({
    booking_type: 'transfer-only',
    num_people: 5,
    transfer_type: 'hiace',
    transfer_direction: 'round_trip',
    total_price: 9500,
    price_snapshot: null,
  }), 'en')

  assert.equal(built.items.length, 1)
  assert.match(built.items[0].description_en, /Transfer/)
  assert.doesNotMatch(built.items[0].description_en, /Accommodation/)
  assert.equal(built.items[0].quantity, 5)
  assert.equal(built.items[0].unitPrice, 1900)
})

// ─── Accommodation and package bookings ───

test('accommodation-only booking itemises the room and the meal plan separately', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'accommodation-only',
    num_people: 2,
    nights: 3,
    room_type: 'double',
    meal_plan_key: 'breakfast',
    accommodations: { name_ar: 'نايلة', name_en: 'Nayla' },
    total_price: 6600,
    price_snapshot: {
      room_type: 'double',
      num_rooms: 1,
      nights: 3,
      accommodation_subtotal: 6000,
      meal_plan_key: 'breakfast',
      meal_plan_price_per_person_per_night: 100,
      meal_subtotal: 600,
      num_people: 2,
      total: 6600,
      computed_at: '2026-09-01T00:00:00Z',
    },
  }), 'en')

  assert.equal(built.items.length, 2)
  assert.match(built.items[0].description_en, /Accommodation — Nayla/)
  assert.equal(built.items[0].unitPrice, 6000)
  assert.match(built.items[1].description_en, /Meal plan/)
  assert.equal(built.items[1].unitPrice, 600)

  assert.equal(valueOf(built.details, 'Room type'), 'Double room')
  assert.equal(valueOf(built.details, 'Nights'), '3 nights')
  assert.equal(valueOf(built.details, 'Meal plan'), 'Breakfast')
  // An accommodation-only booking must not invent a transfer.
  assert.equal(valueOf(built.details, 'Transfer type'), undefined)
  assert.ok(built.items.every(i => !/Transfer/.test(i.description_en)))

  const subtotal = built.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  assert.equal(subtotal, 6600)
})

test('package booking itemises accommodation, transfer and meals, and the lines sum to the total', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'package',
    num_people: 4,
    nights: 3,
    room_type: 'double',
    transfer_type: 'package_bus',
    transfer_direction: 'round_trip',
    accommodations: { name_ar: 'نايلة', name_en: 'Nayla' },
    total_price: 12400,
    price_snapshot: {
      room_type: 'double',
      num_rooms: 2,
      nights: 3,
      accommodation_subtotal: 9000,
      transfer_rate_used: 800,
      transfer_subtotal: 3200,
      meal_plan_price_per_person_per_night: 0,
      meal_subtotal: 200,
      num_people: 4,
      total: 12400,
      computed_at: '2026-09-01T00:00:00Z',
    },
  }), 'en')

  const descriptions = built.items.map(i => i.description_en).join(' | ')
  assert.match(descriptions, /Accommodation/)
  assert.match(descriptions, /Transfer/)
  assert.match(descriptions, /Meal plan/)

  const subtotal = built.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  assert.equal(subtotal, 12400)
  assert.equal(valueOf(built.details, 'Room type'), '2 × Double room')
})

test('a discounted extra trip is itemised with its pre-discount price and a discount row', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'package',
    num_people: 2,
    nights: 3,
    total_price: 10800,
    price_snapshot: {
      nights: 3,
      accommodation_subtotal: 9000,
      extra_trips: [{
        trip_id: 't1',
        name_en: 'Blue Hole',
        price: 900,
        price_before_discount: 1000,
        discount_per_person: 100,
      }],
      extra_trips_subtotal: 1800,
      num_people: 2,
      total: 10800,
      computed_at: '2026-09-01T00:00:00Z',
    },
  }), 'en')

  const tripLine = built.items.find(i => /Blue Hole/.test(i.description_en))
  assert.ok(tripLine, 'the extra trip should be its own line')
  assert.equal(tripLine.quantity, 2)
  assert.equal(tripLine.unitPrice, 900)
  assert.match(tripLine.meta_en!, /Was 1,000 EGP/)

  assert.equal(built.discount?.amount, 200)
})

test('an admin price override is shown as an explicit discount, not folded away', () => {
  const built = buildAccommodationInvoice(booking({
    booking_type: 'transfer-only',
    num_people: 5,
    transfer_type: 'hiace',
    transfer_direction: 'round_trip',
    total_price: 9000,
    price_snapshot: {
      transfer_rate_used: 1900,
      transfer_subtotal: 9500,
      num_people: 5,
      total: 9000,
      computed_total: 9500,
      price_override: true,
      price_override_reason: 'returning customer',
      computed_at: '2026-09-01T00:00:00Z',
    },
  }), 'en')

  // The lines still describe the booking in full...
  assert.equal(built.items[0].quantity * built.items[0].unitPrice, 9500)
  // ...and the gap down to the agreed total is a visible adjustment.
  assert.equal(built.discount?.amount, 500)
})

// ─── Trip bookings ───

test('a standalone trip booking prices per person and shows the trip name', () => {
  const built = buildTripInvoice({
    num_people: 5,
    preferred_date: '2026-09-20',
    quoted_price: 4500,
    final_price: null,
    trip_package_id: null,
    price_snapshot: {
      unit_price_before_discount: 1000,
      discount_per_person: 100,
      discount_type: 'percentage',
      discount_value: 10,
      unit_price: 900,
      num_people: 5,
      total: 4500,
      computed_at: '2026-09-01T00:00:00Z',
    },
    package_snapshot: null,
    sinai_trips: { name_ar: 'الوادي الملون', name_en: 'Colored Canyon' },
    trip_packages: null,
  }, 'en')

  assert.equal(valueOf(built.details, 'Trip'), 'Colored Canyon')
  assert.equal(valueOf(built.details, 'Number of people'), '5 people')
  assert.equal(built.items[0].quantity, 5)
  // Charged at the pre-discount price, with the saving as its own row, so
  // the customer can see what the discount was worth.
  assert.equal(built.items[0].unitPrice, 1000)
  assert.equal(built.discount?.amount, 500)
  assert.match(built.discount!.label_en, /10%/)

  const subtotal = built.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  assert.equal(subtotal - built.discount!.amount, 4500)
})

test('an undiscounted trip booking has no discount row', () => {
  const built = buildTripInvoice({
    num_people: 3,
    preferred_date: null,
    quoted_price: 3000,
    final_price: null,
    trip_package_id: null,
    price_snapshot: null,
    package_snapshot: null,
    sinai_trips: { name_ar: 'رحلة', name_en: 'Blue Hole' },
    trip_packages: null,
  }, 'en')

  assert.equal(built.discount, undefined)
  assert.equal(built.items[0].quantity, 3)
  assert.equal(built.items[0].unitPrice, 1000)
})

test('a trip-PACKAGE booking uses the package name, not the generic "Sinai Trip" label', () => {
  const built = buildTripInvoice({
    num_people: 2,
    preferred_date: '2026-10-01',
    quoted_price: 3000,
    final_price: null,
    trip_package_id: 'pkg1',
    price_snapshot: null,
    package_snapshot: {
      name_ar: 'باقة المغامرة',
      name_en: 'Adventure Bundle',
      package_total: 1500,
      trips: [
        { name_ar: 'الوادي الملون', name_en: 'Colored Canyon' },
        { name_ar: 'البلو هول', name_en: 'Blue Hole' },
      ],
    },
    sinai_trips: null,
    trip_packages: { name_ar: 'باقة المغامرة', name_en: 'Adventure Bundle' },
  }, 'en')

  assert.match(built.items[0].description_en, /Adventure Bundle/)
  assert.doesNotMatch(built.items[0].description_en, /Sinai Trip/)
  assert.equal(built.items[0].quantity, 2)
  assert.equal(built.items[0].unitPrice, 1500)
  // The customer can see which trips the bundle actually contains.
  assert.match(valueOf(built.details, 'Included trips')!, /Colored Canyon/)
  assert.match(valueOf(built.details, 'Included trips')!, /Blue Hole/)
})

test('final_price wins over quoted_price when an admin has settled the amount', () => {
  const built = buildTripInvoice({
    num_people: 2,
    preferred_date: null,
    quoted_price: 3000,
    final_price: 2500,
    trip_package_id: null,
    price_snapshot: null,
    package_snapshot: null,
    sinai_trips: { name_ar: 'رحلة', name_en: 'Blue Hole' },
    trip_packages: null,
  }, 'en')

  assert.equal(built.items[0].unitPrice, 1250)
})
