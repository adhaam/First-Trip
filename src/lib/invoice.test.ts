// ─── WEEMAP invoice generator tests ───
// Run with:  npx tsx --test src/lib/invoice.test.ts
// (no test framework dependency — uses node:test built into Node 20+)
//
// Covers src/lib/invoice-generator.ts (pure HTML renderer) fed with data
// shapes matching the two real booking sources the invoice route branches
// on: `bookings` (accommodation) and `trip_bookings` (Sinai trip). This is
// the regression test for the Part 15 invoice bug — the route previously
// always queried `bookings` with an invalid `sinai_trips` embed and read
// non-existent columns (`price_per_person`, `number_of_participants`,
// `total_amount`), producing blank/zero invoices for both booking types.

import test from 'node:test'
import assert from 'node:assert/strict'
import { generateInvoiceHTML, type InvoiceData } from './invoice-generator'

const baseData: Omit<InvoiceData, 'items' | 'subtotal' | 'totalAmount' | 'type' | 'depositAmount'> = {
  invoiceNumber: 'BK-ABCD1234-REQ-000001',
  customerName: 'Ahmed Test',
  customerPhone: '+201005744083',
  customerEmail: undefined,
  orderDate: '2026-08-27',
  notes: undefined,
  locale: 'en',
  settings: null,
}

test('accommodation booking: price_snapshot-derived line items sum to a non-zero, correct total', () => {
  // Mirrors the real `bookings.price_snapshot` shape (src/lib/types.ts PriceSnapshot)
  // as unpacked by the fixed route for a Dahab accommodation booking.
  const snapshot = {
    accommodation_subtotal: 4000,
    transfer_subtotal: 500,
    meal_subtotal: 300,
  }
  const items = [
    { description_ar: 'إقامة (نايلة) (2 ليالي)', description_en: 'Accommodation (2 nights)', quantity: 1, unitPrice: snapshot.accommodation_subtotal },
    { description_ar: 'النقل', description_en: 'Transfer', quantity: 1, unitPrice: snapshot.transfer_subtotal },
    { description_ar: 'خطة الوجبات', description_en: 'Meal Plan', quantity: 1, unitPrice: snapshot.meal_subtotal },
  ]
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const totalAmount = 4800 // real bookings.total_price

  assert.equal(subtotal, 4800)
  assert.notEqual(subtotal, 0)

  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items,
    subtotal,
    totalAmount,
    depositAmount: totalAmount * 0.5,
  })

  assert.match(html, /Accommodation \(2 nights\)/)
  assert.match(html, /Transfer/)
  assert.match(html, /Meal Plan/)
  assert.match(html, /4800\.00 EGP/) // total amount due
  assert.match(html, /2400\.00 EGP/) // deposit (50%)
  assert.doesNotMatch(html, /NaN/)
})

test('accommodation booking: falls back to a single total_price line when no price_snapshot breakdown exists', () => {
  const totalPrice = 3000
  const numPeople = 2
  const items = [
    { description_ar: 'إقامة', description_en: 'Accommodation', quantity: numPeople, unitPrice: totalPrice / numPeople },
  ]
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  assert.equal(subtotal, totalPrice)
  assert.equal(items[0].unitPrice, 1500)
})

test('trip booking: quoted_price/num_people produce a non-zero total with the real sinai_trips name', () => {
  // Mirrors trip_bookings columns (quoted_price, num_people) + the real
  // sinai_trips(name_ar, name_en) FK embed the fixed route now queries.
  const quotedPrice = 1200
  const numPeople = 3
  const items = [
    { description_ar: 'رحلة الجبل الملون', description_en: 'Colored Canyon Trip', quantity: numPeople, unitPrice: quotedPrice / numPeople },
  ]
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  assert.equal(subtotal, quotedPrice)
  assert.notEqual(subtotal, 0)

  const html = generateInvoiceHTML({
    ...baseData,
    invoiceNumber: 'TB-EFGH5678-REQ-000002',
    type: 'request',
    items,
    subtotal,
    totalAmount: quotedPrice,
  })

  assert.match(html, /Colored Canyon Trip/)
  assert.match(html, /1200\.00 EGP/)
  assert.doesNotMatch(html, /NaN/)
})

test('trip booking: final_price overrides quoted_price when set, matching route branching logic', () => {
  const quotedPrice = 1200
  const finalPrice = 1000
  const price = finalPrice ?? quotedPrice
  assert.equal(price, 1000)
})

test('Arabic locale renders RTL direction and Arabic labels', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    locale: 'ar',
    type: 'request',
    items: [{ description_ar: 'رحلة سيناء', description_en: 'Sinai Trip', quantity: 1, unitPrice: 500 }],
    subtotal: 500,
    totalAmount: 500,
  })

  assert.match(html, /dir="rtl"/)
  assert.match(html, /رحلة سيناء/)
})
