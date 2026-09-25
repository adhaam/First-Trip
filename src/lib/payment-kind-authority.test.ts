/**
 * The stored `payment_kind` on bookings / trip_bookings is authoritative
 * business truth (supabase/migrations/030_payment_policies.sql). No
 * application code writes it: the DB's weemap_set_payment_kind BEFORE
 * INSERT trigger derives it when the inserted row omits it. These tests
 * prove the application-level half of that contract — request input can
 * never put a payment_kind (or any other payment-policy field) into a row
 * the app inserts — across every request path that builds a bookings /
 * trip_bookings / trip_requests row, public and admin.
 *
 * "stored payment_kind wins over any legacy/derived fallback" is covered by
 * payment-rules.test.ts's 'paymentKindFor prioritizes stored payment_kind
 * over legacy fallbacks' — not duplicated here.
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { adminTripBookingSchema, buildAdminTripBookingRow, buildManualBookingRow, manualBookingSchema } from './admin-booking-rows'
import { paymentKindFor, paymentPlan } from './payment-rules'
import type { TripDiscountInput } from './pricing'
import { bookingSchema, buildBookingRow } from './public-booking'
import { buildPublicTripBookingRow, tripBookingSchema } from './public-trip-booking'
import { tripRequestPaymentParts } from './trip-requests/build'
import { tripRequestSchema } from './trip-requests/schema'
import type { PriceSnapshot, TripBookingPriceSnapshot, TripPackage } from './types'

const TRIP_ID = '11111111-1111-4111-8111-111111111111'
const PACKAGE_ID = '22222222-2222-4222-8222-222222222222'
const ACC_ID = '33333333-3333-4333-8333-333333333333'

test("standalone trip: client-supplied payment_kind 'stay' never reaches the inserted trip_bookings row", () => {
  const body = {
    trip_id: TRIP_ID,
    customer_name: 'Nour Ahmed',
    customer_phone: '01012345678',
    num_people: 2,
    // Junk a malicious or buggy client could send.
    payment_kind: 'stay',
    payment_plan: { kind: 'combined', upfrontAmount: 0 },
    upfront_percent: 999,
  }

  const parsed = tripBookingSchema.parse(body)
  assert.ok(!('payment_kind' in parsed), 'parsed input must not carry payment_kind')
  assert.ok(!('payment_plan' in parsed), 'parsed input must not carry payment_plan')
  assert.ok(!('upfront_percent' in parsed), 'parsed input must not carry upfront_percent')

  const trip: TripDiscountInput = { price: 500 }
  const row = buildPublicTripBookingRow(parsed, { kind: 'standalone', trip })
  assert.ok(!('payment_kind' in row), 'inserted trip_bookings row must not carry payment_kind')

  // The shape the DB trigger produces for a standalone trip booking
  // (trip_package_id IS NULL) once it has run: payment_kind = 'trip'.
  assert.equal(paymentKindFor({ trip_package_id: null, payment_kind: 'trip' }), 'trip')
})

test("experience package: client-supplied payment_kind 'stay_package' never reaches the inserted trip_bookings row", () => {
  const body = {
    trip_package_id: PACKAGE_ID,
    customer_name: 'Nour Ahmed',
    customer_phone: '01012345678',
    num_people: 2,
    payment_kind: 'stay_package',
    payment_plan: { kind: 'combined', upfrontAmount: 0 },
    upfront_percent: 999,
  }

  const parsed = tripBookingSchema.parse(body)
  assert.ok(!('payment_kind' in parsed), 'parsed input must not carry payment_kind')

  const pkg: TripPackage = {
    id: PACKAGE_ID,
    slug: 'sinai-bundle',
    name_ar: 'حزمة سيناء',
    name_en: 'Sinai Bundle',
    short_description_ar: '',
    short_description_en: '',
    description_ar: '',
    description_en: '',
    image: '',
    featured: false,
    is_active: true,
    sort_order: 0,
    created_at: '2026-09-25T00:00:00.000Z',
    trips: [],
    totals: { publicTotal: 1800, packageTotal: 1500, savings: 300, isValid: true },
  }

  const row = buildPublicTripBookingRow(parsed, { kind: 'package', pkg })
  assert.ok(!('payment_kind' in row), 'inserted trip_bookings row must not carry payment_kind')

  // ─── Trip Builder path (src/lib/trip-requests) ───
  // A client-supplied payment_kind on an experience selection must be
  // stripped by the schema, and the payment parts must come from the
  // server-side catalogue lookup map — never the client.
  const experienceWithPaymentKind = { kind: 'trip_package', id: PACKAGE_ID, payment_kind: 'stay_package' }
  const parsedRequest = tripRequestSchema.parse({
    locale: 'en',
    transport_mode: 'stay_only',
    arrival_date: '2026-10-10',
    departure_date: '2026-10-13',
    adults: 2,
    accommodation_id: ACC_ID,
    experiences: [experienceWithPaymentKind],
    contact: { name: 'Nour Ahmed', phone: '01012345678' },
  })
  assert.deepEqual(
    parsedRequest.experiences,
    [{ kind: 'trip_package', id: PACKAGE_ID }],
    'the schema must strip any client-supplied payment_kind from an experience selection',
  )

  const snapshot: PriceSnapshot = {
    total: 4500,
    num_people: 2,
    computed_at: '2026-09-25T00:00:00.000Z',
    trip_packages: [{ package_id: PACKAGE_ID, name_en: 'Sinai Bundle', trip_names_en: [], total: 1500 }],
  }
  // Server catalogue lookup map — the ONLY source for a trip package's
  // payment kind, never the client-sent value.
  const packagePaymentKinds = { [PACKAGE_ID]: 'experience_package' as const }
  const parts = tripRequestPaymentParts(parsedRequest, { total: 4500, snapshot }, packagePaymentKinds)
  assert.deepEqual(parts, [
    { kind: 'stay', total: 3000 },
    { kind: 'experience_package', total: 1500 },
  ])

  const experiencePart = parts.find((part) => part.kind === 'experience_package')
  assert.ok(experiencePart)
  const plan = paymentPlan(experiencePart.kind, experiencePart.total)
  assert.equal(plan.upfrontPercent, 100)
  assert.equal(plan.upfrontAmount, 1500)
  assert.equal(plan.balanceAmount, 0)
  assert.equal(plan.upfrontDue, 'after_confirmation')
  assert.equal(plan.balanceDue, null)
})

test("Dahab stay package: client-supplied payment_kind 'experience_package' never reaches the inserted bookings row", () => {
  const body = {
    customer_name: 'Nour Ahmed',
    customer_phone: '01012345678',
    booking_type: 'package',
    accommodation_id: ACC_ID,
    governorate: 'CAI',
    trip_date: '2026-10-01',
    transfer_type: 'package_bus',
    num_people: 2,
    payment_kind: 'experience_package',
    payment_plan: { kind: 'combined', upfrontAmount: 0 },
    upfront_percent: 999,
  }

  const parsed = bookingSchema.parse(body)
  assert.ok(!('payment_kind' in parsed), 'parsed input must not carry payment_kind')

  const quote = { total: 4000, snapshot: { total: 4000, computed_at: '2026-09-25T00:00:00.000Z' } as PriceSnapshot }
  const row = buildBookingRow(parsed, quote)
  assert.ok(!('payment_kind' in row), 'inserted bookings row must not carry payment_kind')

  // The shape the DB trigger produces for a 'package' booking once it has
  // run: booking_type 'package' -> payment_kind 'stay_package'.
  assert.equal(paymentKindFor({ booking_type: 'package', payment_kind: 'stay_package' }), 'stay_package')

  const plan = paymentPlan('stay_package', 4000)
  assert.equal(plan.upfrontPercent, 50)
  assert.equal(plan.upfrontAmount, 2000)
  assert.equal(plan.balanceAmount, 2000)
  assert.equal(plan.upfrontDue, 'after_confirmation')
  assert.equal(plan.balanceDue, 'on_arrival')
})

// "stored payment_kind wins over any legacy/derived fallback" is already
// covered by payment-rules.test.ts's
// 'paymentKindFor prioritizes stored payment_kind over legacy fallbacks' —
// not duplicated here.

// ─── Admin (staff) creation paths ───

test("admin manual booking: staff-supplied payment_kind never reaches the inserted bookings row", () => {
  const input = manualBookingSchema.parse({
    customer_name: 'Staff-entered booking',
    customer_phone: '01012345678',
    booking_type: 'accommodation-only',
    accommodation_id: ACC_ID,
    trip_date: '2026-10-01',
    nights: 3,
    num_people: 2,
    payment_kind: 'experience_package',
  } as Record<string, unknown>)
  assert.ok(!('payment_kind' in input), 'parsed admin input must not carry payment_kind')

  const row = buildManualBookingRow(input, { totalPrice: 2000, priceSnapshot: null }, 'cust-1')
  assert.ok(!('payment_kind' in row), 'inserted bookings row must not carry payment_kind')
})

test("admin trip booking: staff-supplied payment_kind never reaches the inserted trip_bookings row", () => {
  const input = adminTripBookingSchema.parse({
    customer_name: 'A',
    customer_phone: '01012345678',
    trip_id: TRIP_ID,
    payment_kind: 'stay_package',
  } as Record<string, unknown>)
  assert.ok(!('payment_kind' in input), 'parsed admin input must not carry payment_kind')

  const snapshot: TripBookingPriceSnapshot = {
    unit_price_before_discount: 1000,
    discount_per_person: 0,
    discount_type: null,
    discount_value: 0,
    unit_price: 1000,
    num_people: 1,
    total: 1000,
    computed_at: '2026-09-25T00:00:00.000Z',
  }
  const row = buildAdminTripBookingRow(input, snapshot, 'cust-1')
  assert.ok(!('payment_kind' in row), 'inserted trip_bookings row must not carry payment_kind')
})
