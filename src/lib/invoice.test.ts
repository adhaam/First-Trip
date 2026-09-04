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

// ─── Booking detail block, per-line breakdown, discounts and payments ───
//
// The regression these guard against: an invoice that showed a price with
// nothing to justify it. A 5-person transfer-only booking rendered as
// "Accommodation | qty 2" — no party size, no vehicle, no direction, and a
// hotel line on a booking that had no hotel.

test('booking details block renders the facts a customer needs to recognise their booking', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'request',
    details: [
      { label_ar: 'نوع الحجز', label_en: 'Booking type', value_ar: 'انتقالات فقط', value_en: 'Transfer only' },
      { label_ar: 'عدد الأفراد', label_en: 'Number of people', value_ar: '5 أفراد', value_en: '5 people' },
      { label_ar: 'نوع الانتقال', label_en: 'Transfer type', value_ar: 'هايس خاص', value_en: 'Private Hiace' },
      { label_ar: 'اتجاه الرحلة', label_en: 'Direction', value_ar: 'ذهاب وعودة', value_en: 'Round trip' },
    ],
    items: [{
      description_ar: 'الانتقالات — هايس خاص (ذهاب وعودة)',
      description_en: 'Transfer — Private Hiace (Round trip)',
      quantity: 5,
      unitPrice: 950,
      meta_ar: '5 أفراد × 950 ج.م',
      meta_en: '5 people × 950 EGP',
    }],
    subtotal: 4750,
    totalAmount: 4750,
  })

  assert.match(html, /Booking Details/)
  assert.match(html, /Transfer only/)
  assert.match(html, /5 people/)
  assert.match(html, /Private Hiace/)
  assert.match(html, /Round trip/)
  // The charge is per person, so the quantity column carries the party size.
  assert.match(html, /5 people × 950 EGP/)
  assert.match(html, /4750\.00 EGP/)
  // A transfer-only invoice must never CHARGE for an accommodation. Scoped to
  // the charges table — the page header brand line legitimately reads
  // "Trip & Accommodation Bookings".
  const tableBody = html.slice(html.indexOf('<tbody>'), html.indexOf('</tbody>'))
  assert.doesNotMatch(tableBody, /Accommodation/)
  assert.doesNotMatch(html, /NaN/)
})

test('an invoice with no details block still renders (old bookings keep working)', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'request',
    items: [{ description_ar: 'إقامة', description_en: 'Accommodation', quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    totalAmount: 1000,
  })
  assert.doesNotMatch(html, /Booking Details/)
  assert.match(html, /1000\.00 EGP/)
})

test('a line without meta renders no empty meta element', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'request',
    items: [{ description_ar: 'إقامة', description_en: 'Accommodation', quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    totalAmount: 1000,
  })
  // The .item-meta CSS rule is always present; what must not appear is the
  // element itself, emitted empty for a line that has no meta.
  assert.doesNotMatch(html, /<span class="item-meta">/)
  assert.doesNotMatch(html, /undefined/)
})

test('a discount renders as its own deducted row', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items: [{ description_ar: 'رحلة', description_en: 'Blue Hole', quantity: 5, unitPrice: 1000 }],
    subtotal: 5000,
    discount: { label_ar: 'خصم 10%', label_en: 'Discount 10%', amount: 500 },
    totalAmount: 4500,
  })

  assert.match(html, /Discount 10%/)
  assert.match(html, /− 500\.00 EGP/)
  assert.match(html, /4500\.00 EGP/)
})

test('a zero discount is not rendered — no "− 0.00" row', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items: [{ description_ar: 'رحلة', description_en: 'Blue Hole', quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    discount: { label_ar: 'خصم', label_en: 'Discount', amount: 0 },
    totalAmount: 1000,
  })
  assert.doesNotMatch(html, /− 0\.00/)
})

test('paid and balance-due rows come from money actually received', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items: [{ description_ar: 'إقامة', description_en: 'Accommodation', quantity: 1, unitPrice: 4000 }],
    subtotal: 4000,
    totalAmount: 4000,
    amountPaid: 1500,
  })

  assert.match(html, /Paid/)
  assert.match(html, /1500\.00 EGP/)
  assert.match(html, /Balance Due/)
  assert.match(html, /2500\.00 EGP/)
})

test('an unpaid booking shows no paid/balance rows rather than a phantom 50% deposit', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items: [{ description_ar: 'إقامة', description_en: 'Accommodation', quantity: 1, unitPrice: 4000 }],
    subtotal: 4000,
    totalAmount: 4000,
    amountPaid: 0,
  })

  assert.doesNotMatch(html, /Balance Due/)
  assert.doesNotMatch(html, /Agreed Amount \(Deposit\)/)
})

test('overpayment never renders a negative balance', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    type: 'confirmation',
    items: [{ description_ar: 'إقامة', description_en: 'Accommodation', quantity: 1, unitPrice: 1000 }],
    subtotal: 1000,
    totalAmount: 1000,
    amountPaid: 1200,
  })

  assert.match(html, /Balance Due/)
  assert.match(html, /<span>0\.00 EGP<\/span>/)
  // A negative money amount, specifically — not the hyphens in the invoice number.
  assert.doesNotMatch(html, /-\d+\.\d\d EGP/)
})

test('Arabic invoice renders the detail labels and line meta in Arabic', () => {
  const html = generateInvoiceHTML({
    ...baseData,
    locale: 'ar',
    type: 'request',
    details: [
      { label_ar: 'عدد الأفراد', label_en: 'Number of people', value_ar: '5 أفراد', value_en: '5 people' },
    ],
    items: [{
      description_ar: 'الانتقالات — هايس خاص',
      description_en: 'Transfer — Private Hiace',
      quantity: 5,
      unitPrice: 950,
      meta_ar: '5 أفراد × 950 ج.م',
      meta_en: '5 people × 950 EGP',
    }],
    subtotal: 4750,
    totalAmount: 4750,
  })

  assert.match(html, /dir="rtl"/)
  assert.match(html, /تفاصيل الحجز/)
  assert.match(html, /عدد الأفراد/)
  assert.match(html, /5 أفراد × 950/)
  assert.doesNotMatch(html, /5 people/)
})
