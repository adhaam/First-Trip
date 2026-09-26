import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  adminTripBookingSchema,
  bookingCustomerInput,
  buildAdminTripBookingRow,
  buildManualBookingRow,
  manualBookingSchema,
  resolveManualBookingPricing,
} from './admin-booking-rows'
import { BOOKING_SOURCES } from './booking-sources'
import { findOrCreateCustomerWithClient } from './customer-resolution'
import { createFakeSupabase } from './testing/fake-supabase'
import type { PriceSnapshot, TripBookingPriceSnapshot } from './types'

const TRIP_ID = '11111111-1111-4111-8111-111111111111'
const ACC_ID = '22222222-2222-4222-8222-222222222222'

const tripSnapshot: TripBookingPriceSnapshot = {
  unit_price_before_discount: 1000,
  discount_per_person: 100,
  discount_type: 'amount',
  discount_value: 100,
  unit_price: 900,
  num_people: 2,
  total: 1800,
  computed_at: '2026-09-25T00:00:00.000Z',
}

const quoteSnapshot: PriceSnapshot = { total: 5000, num_people: 2, computed_at: '2026-09-25T00:00:00.000Z' }
const noSelections = { extraTripIds: [] as string[], tripPackageIds: [] as string[] }

const existingCustomer = {
  id: 'cust-existing',
  name: 'Mona Adel',
  phone: '01012345678',
  normalized_phone: '+201012345678',
  email: 'mona@example.com',
  whatsapp_phone: null,
  merged_into: null,
}

function manualInput(overrides: Record<string, unknown> = {}) {
  return manualBookingSchema.parse({
    customer_name: 'M. Adel (typed by staff)',
    customer_phone: '010 1234 5678',
    customer_email: 'typo@example.com',
    booking_type: 'accommodation-only',
    accommodation_id: ACC_ID,
    trip_date: '2026-10-01',
    nights: 3,
    num_people: 2,
    ...overrides,
  })
}

// ─── Source channel ───

test('admin trip booking defaults to source "manual", an allowed CHECK value — never "admin"', () => {
  const input = adminTripBookingSchema.parse({ customer_name: 'A', customer_phone: '01012345678', trip_id: TRIP_ID })
  const row = buildAdminTripBookingRow(input, tripSnapshot, 'cust-1')
  assert.equal(row.source, 'manual')
  assert.ok((BOOKING_SOURCES as readonly string[]).includes(row.source as string))
})

test('admin trip booking records the real channel when staff supplies one', () => {
  const input = adminTripBookingSchema.parse({
    customer_name: 'A', customer_phone: '01012345678', trip_id: TRIP_ID, source: 'instagram',
  })
  assert.equal(buildAdminTripBookingRow(input, tripSnapshot, 'cust-1').source, 'instagram')
})

test('staff routes reject "admin", "website" and unknown sources', () => {
  for (const source of ['admin', 'website', 'tiktok']) {
    assert.equal(
      adminTripBookingSchema.safeParse({ customer_name: 'A', customer_phone: '01012345678', trip_id: TRIP_ID, source }).success,
      false,
      `trip: ${source}`,
    )
    assert.equal(manualBookingSchema.safeParse({ ...manualInput(), source }).success, false, `manual: ${source}`)
  }
})

test('manual accommodation booking defaults to source "manual"', () => {
  assert.equal(manualInput().source, 'manual')
})

// ─── Admin trip booking row ───

test('admin trip booking row carries customer_id and server-computed price', () => {
  const input = adminTripBookingSchema.parse({
    customer_name: 'A', customer_phone: '01012345678', trip_id: TRIP_ID, num_people: 2, quoted_price: 1,
  })
  const row = buildAdminTripBookingRow(input, tripSnapshot, 'cust-42')
  assert.equal(row.customer_id, 'cust-42')
  assert.equal(row.quoted_price, 1800, 'client quoted_price ignored without price_override')
  assert.deepEqual(row.price_snapshot, tripSnapshot)
  assert.equal(row.status, 'new')
  assert.equal(row.context, 'standalone')
  assert.equal(row.preferred_date, null)
  assert.equal(row.notes, null)
})

test('admin trip booking override keeps the computed breakdown alongside the agreed total', () => {
  const input = adminTripBookingSchema.parse({
    customer_name: 'A', customer_phone: '01012345678', trip_id: TRIP_ID, num_people: 2,
    quoted_price: 1500, price_override: true, price_override_reason: 'loyal customer',
  })
  const row = buildAdminTripBookingRow(input, tripSnapshot, 'cust-1')
  assert.equal(row.quoted_price, 1500)
  assert.deepEqual(row.price_snapshot, {
    ...tripSnapshot,
    price_override: true,
    computed_total: 1800,
    price_override_reason: 'loyal customer',
    total: 1500,
  })
})

// ─── Manual accommodation booking row ───

test('manual booking row carries customer_id and never includes request-only fields', () => {
  const input = manualInput({ price_override: false, price_override_reason: 'x' })
  const row = buildManualBookingRow(input, { totalPrice: 5000, priceSnapshot: quoteSnapshot, normalizedSelections: noSelections }, 'cust-7')
  assert.equal(row.customer_id, 'cust-7')
  assert.equal(row.total_price, 5000)
  assert.equal(row.price_snapshot, quoteSnapshot)
  assert.equal(row.source, 'manual')
  assert.equal(row.status, 'confirmed')
  assert.ok(!('price_override' in row))
  assert.ok(!('price_override_reason' in row))
  assert.deepEqual(row.extra_trip_ids, [])
  assert.deepEqual(row.trip_package_ids, [])
})

test('manual booking row turns empty optional strings into nulls', () => {
  const input = manualInput({ customer_email: '', accommodation_id: '', governorate: '', trip_date: '', return_date: '', meal_plan_key: '' })
  const row = buildManualBookingRow(input, { totalPrice: undefined, priceSnapshot: null, normalizedSelections: null }, 'c')
  for (const k of ['customer_email', 'accommodation_id', 'governorate', 'trip_date', 'return_date', 'meal_plan_key', 'total_price']) {
    assert.equal(row[k], null, k)
  }
})

test('manual pricing: computed total wins over a typed one unless explicitly overridden', () => {
  const quote = { ok: true as const, total: 5000, snapshot: quoteSnapshot, normalizedSelections: noSelections }
  assert.equal(resolveManualBookingPricing({ total_price: 1 }, quote).totalPrice, 5000)

  const overridden = resolveManualBookingPricing({ total_price: 4000, price_override: true, price_override_reason: 'deal' }, quote)
  assert.equal(overridden.totalPrice, 4000)
  assert.deepEqual(overridden.priceSnapshot, {
    ...quoteSnapshot, price_override: true, computed_total: 5000, price_override_reason: 'deal', total: 4000,
  })
})

test('manual pricing: no date keeps the typed total; a failed quote keeps it and reports why', () => {
  assert.deepEqual(resolveManualBookingPricing({ total_price: 300 }, null), { totalPrice: 300, priceSnapshot: null, pricingNote: null, normalizedSelections: null })
  assert.deepEqual(
    resolveManualBookingPricing({ total_price: 300 }, { ok: false, error: 'no rates' }),
    { totalPrice: 300, priceSnapshot: null, pricingNote: 'no rates', normalizedSelections: null },
  )
})

// ─── Customer resolution call path (fake Supabase) ───

test('manual booking for a known phone links the existing customer without clobbering name/email', async () => {
  const { client, tables, ops } = createFakeSupabase({ customers: [existingCustomer] })
  const input = manualInput()

  const customer = await findOrCreateCustomerWithClient(client, bookingCustomerInput(input))
  const row = buildManualBookingRow(input, { totalPrice: 5000, priceSnapshot: quoteSnapshot, normalizedSelections: noSelections }, customer.id)

  assert.equal(row.customer_id, 'cust-existing')
  assert.equal(tables.customers.length, 1, 'no duplicate customer created')
  assert.equal(tables.customers[0].name, 'Mona Adel')
  assert.equal(tables.customers[0].email, 'mona@example.com')
  assert.ok(!ops.some((o) => o.kind === 'insert'), 'no customers insert/upsert')
  // The booking row itself keeps what staff typed for this booking.
  assert.equal(row.customer_name, 'M. Adel (typed by staff)')
})

test('admin trip booking for a new phone creates one customer and links it', async () => {
  const { client, tables } = createFakeSupabase({ customers: [existingCustomer] })
  const input = adminTripBookingSchema.parse({ customer_name: 'Karim', customer_phone: '0111 222 3333', trip_id: TRIP_ID })

  const customer = await findOrCreateCustomerWithClient(client, bookingCustomerInput(input))
  const row = buildAdminTripBookingRow(input, tripSnapshot, customer.id)

  assert.equal(tables.customers.length, 2)
  const created = tables.customers.find((c) => c.normalized_phone === '+201112223333')
  assert.ok(created)
  assert.equal(row.customer_id, created.id)
  assert.equal(row.source, 'manual')
})

test('bookingCustomerInput maps an empty email to null', () => {
  assert.deepEqual(
    bookingCustomerInput({ customer_name: 'A', customer_phone: '1', customer_email: '' }),
    { phone: '1', name: 'A', email: null },
  )
})
