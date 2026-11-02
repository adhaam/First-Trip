// ─── Customer documents: quotation, booking confirmation & payment request, receipt ───
// Run with:  npx tsx --test src/lib/documents/documents.test.ts
//
// Pure builders only (no DB, no network): the due-now / due-later maths, the
// availability gate, the receipt's ledger-only figures, and the guarantees
// every document shares (not-a-tax-invoice footer, logo, RTL, no "Invoice" title).

import assert from 'node:assert/strict'
import test from 'node:test'
import { buildInvoiceData, bookingReference, type InvoiceSource } from '../invoice-items'
import { generateInvoiceHTML } from '../invoice-generator'
import { paymentPlan } from '../payment-rules'
import { generateQuotationHTML, quotationLines, type QuotationInput, type QuotationJourney } from '../quotation-document'
import {
  cairoCompactDate, cairoDate, cairoDateTime, NOT_TAX_INVOICE_AR, NOT_TAX_INVOICE_EN,
} from './format'
import { buildJourneyConfirmation, type JourneyConfirmationInput } from './journey-confirmation'
import { DOCUMENT_LOGO_DATA_URI } from './logo-data'
import { computePaymentDue } from './payment-due'
import { buildReceipt, receiptNumber, receiptStatus, type ReceiptRecord } from './receipt'

const journey: QuotationJourney = {
  arrival_date: '2026-11-06', departure_date: '2026-11-10', nights: 4, adults: 2, children: 0,
  transport_mode: 'hiace', origin: { name_en: 'Cairo', name_ar: 'القاهرة' },
  stay: { name_en: 'Blue Lagoon Camp', name_ar: 'مخيم بلو لاجون' },
  rooms: [{ type: 'double', count: 1 }],
  meal_plan: null,
  experiences: [{ name_en: 'Blue Hole', name_ar: 'البلو هول' }],
}

const lines = [
  { key: 'accommodation', label_en: 'Accommodation', label_ar: 'الإقامة', amount: 8000 },
  { key: 'transfer', label_en: 'Transport', label_ar: 'الانتقالات', amount: 4000 },
]

function confirmation(overrides: Partial<JourneyConfirmationInput> = {}): JourneyConfirmationInput {
  return {
    reference: 'WR-2610-0001',
    status: 'awaiting_payment',
    customer_name: 'Nour Ahmed',
    revision_number: 2,
    journey_row: { transport_mode: 'hiace', accommodation_id: 'acc-1' },
    journey,
    lines,
    total: 12000,
    amount_paid: 0,
    now: new Date('2026-10-20T10:00:00Z'),
    locale: 'en',
    ...overrides,
  }
}

function built(overrides: Partial<JourneyConfirmationInput> = {}) {
  const result = buildJourneyConfirmation(confirmation(overrides))
  assert.ok(result.ok)
  return result
}

// ─── Due now / due later ───

test('50% journey, nothing received: the whole deposit is required now, the rest on arrival', () => {
  const result = built()
  assert.equal(result.due.dueNow, 6000)
  assert.equal(result.due.dueLater, 6000)
  assert.equal(result.due.laterTiming, 'on_arrival')
  assert.match(result.html, /Amount currently required<\/td><td class="num">6,000\.00 EGP/)
  assert.match(result.html, /Balance due later — on arrival<\/td><td class="num">6,000\.00 EGP/)
  assert.doesNotMatch(result.html, /Received to date/)
})

test('50% journey, exactly the deposit received: nothing is due now, the arrival balance remains', () => {
  const result = built({ amount_paid: 6000 })
  assert.equal(result.due.dueNow, 0)
  assert.equal(result.due.dueLater, 6000)
  assert.match(result.html, /Received to date \(per our records\)<\/td><td class="num">6,000\.00 EGP/)
  assert.match(result.html, /Amount currently required<\/td><td class="num">0\.00 EGP/)
  assert.match(result.html, /Balance due later — on arrival<\/td><td class="num">6,000\.00 EGP/)
})

test('50% journey, more than the deposit received: the later balance shrinks and nothing goes negative', () => {
  const result = built({ amount_paid: 9000 })
  assert.equal(result.due.dueNow, 0)
  assert.equal(result.due.dueLater, 3000)
  assert.match(result.html, /Balance due later — on arrival<\/td><td class="num">3,000\.00 EGP/)
  const over = built({ amount_paid: 15000 })
  assert.equal(over.due.dueNow, 0)
  assert.equal(over.due.dueLater, 0)
  assert.doesNotMatch(over.html, /-\d+\.\d\d EGP/)
  assert.doesNotMatch(over.html, /Balance due later/)
})

test('a partial deposit leaves the rest of the deposit due now', () => {
  const due = computePaymentDue({ total: 12000, amountPaid: 2500, plan: paymentPlan('journey', 12000) })
  assert.equal(due.dueNow, 3500)
  assert.equal(due.dueLater, 6000)
})

test('a trips-only journey (self-arrival, no stay) is 100% after confirmation with no later balance', () => {
  const result = built({
    journey_row: { transport_mode: 'stay_only', accommodation_id: null },
    total: 9000,
    lines: [{ key: 'trip', label_en: 'Blue Hole', label_ar: 'البلو هول', amount: 9000 }],
  })
  assert.equal(result.due.dueNow, 9000)
  assert.equal(result.due.dueLater, 0)
  assert.doesNotMatch(result.html, /Balance due later/)
  // A journey with a stay keeps the 50/50 split even when it is self-arrival.
  const withStay = built({ journey_row: { transport_mode: 'stay_only', accommodation_id: 'acc-1' } })
  assert.equal(withStay.due.dueNow, 6000)
})

test('a per-quote plan states no invented amount', () => {
  const due = computePaymentDue({ total: 5000, amountPaid: 0, plan: paymentPlan('journey', 5000, []) })
  assert.equal(due.dueNow, null)
  assert.equal(due.dueLater, null)
  assert.equal(due.remaining, 5000)
})

// ─── Availability gate ───

test('the booking confirmation is refused until availability is confirmed', () => {
  for (const status of ['new', 'checking_availability', 'alternatives_required', 'cancelled']) {
    const result = buildJourneyConfirmation(confirmation({ status }))
    assert.deepEqual(result, { ok: false, code: 'availability_not_confirmed' }, status)
  }
  for (const status of ['awaiting_payment', 'confirmed', 'completed']) {
    assert.equal(buildJourneyConfirmation(confirmation({ status })).ok, true, status)
  }
})

// ─── Never claims money beyond the ledger ───

test('only the deposit recorded: no document says paid or fully paid', () => {
  const html = [
    built({ amount_paid: 6000 }).html,
    built({ amount_paid: 6000, locale: 'ar' }).html,
  ].join('\n')
  assert.doesNotMatch(html, /fully paid/i)
  assert.doesNotMatch(html, /مدفوع بالكامل/)
  assert.doesNotMatch(html, /\bpaid\b/i)
  assert.doesNotMatch(html, /مدفوع/)
})

// ─── Receipt ───

const record: ReceiptRecord = {
  id: 'a1b2c3d4-0000-4000-8000-000000000001',
  entity_type: 'trip_request',
  entity_id: '00000000-0000-4000-8000-0000000000aa',
  direction: 'received',
  amount: 6000,
  method: 'instapay',
  reference: 'IP-998877',
  received_at: '2026-10-14T22:30:00Z',
  amount_paid_after: 6000,
}
const subject = { reference: 'WR-2610-0001', customer_name: 'Nour Ahmed', total: 12000 }

test('receipt number is derived deterministically from the record and the Cairo date', () => {
  assert.equal(receiptNumber(record), 'RC-20261015-A1B2C3D4')
  assert.equal(receiptNumber({ ...record }), receiptNumber(record))
  const other = receiptNumber({ ...record, id: 'ffffffff-0000-4000-8000-000000000002' })
  assert.notEqual(other, receiptNumber(record))
})

test('the Cairo day and time are used across UTC midnight, not the UTC ones', () => {
  assert.equal(cairoDate('2026-10-14T22:30:00Z'), '2026-10-15')
  // Egypt is on UTC+3 in October (summer time) and UTC+2 in winter.
  assert.equal(cairoCompactDate('2026-10-14T20:59:59Z'), '20261014')
  assert.equal(cairoCompactDate('2026-10-14T21:00:00Z'), '20261015')
  assert.equal(cairoCompactDate('2026-12-14T21:59:59Z'), '20261214')
  assert.equal(cairoCompactDate('2026-12-14T22:00:00Z'), '20261215')
  assert.match(cairoDateTime('2026-10-14T22:30:00Z', 'en'), /^2026-10-15 01:30 \(Cairo time\)$/)
  assert.match(cairoDateTime('2026-10-14T22:30:00Z', 'ar'), /^2026-10-15 01:30 \(بتوقيت القاهرة\)$/)
})

test('a partial payment reads "Partially paid" with the remaining balance, never "Fully paid"', () => {
  const result = buildReceipt({ record, subject, locale: 'en' })
  assert.ok(result.ok)
  assert.equal(result.status, 'partial')
  assert.equal(result.remaining, 6000)
  assert.match(result.html, /Partially paid/)
  assert.doesNotMatch(result.html, /Fully paid/)
  assert.match(result.html, /Amount received<\/td><td class="num">6,000\.00 EGP/)
  assert.match(result.html, /Remaining balance<\/td><td class="num">6,000\.00 EGP/)
  assert.match(result.html, /IP-998877/)
  assert.match(result.html, /InstaPay/)
  assert.match(result.html, /2026-10-15 01:30 \(Cairo time\)/)
  assert.match(result.html, /WR-2610-0001/)
})

test('"Fully paid" appears only when the total received as at this payment reaches the booking total', () => {
  assert.equal(receiptStatus(11999.99, 12000), 'partial')
  assert.equal(receiptStatus(12000, 12000), 'full')
  const full = buildReceipt({ record: { ...record, amount: 6000, amount_paid_after: 12000 }, subject, locale: 'en' })
  assert.ok(full.ok)
  assert.equal(full.status, 'full')
  assert.equal(full.remaining, 0)
  assert.match(full.html, /Fully paid/)
  const ar = buildReceipt({ record: { ...record, amount_paid_after: 12000 }, subject, locale: 'ar' })
  assert.ok(ar.ok)
  assert.match(ar.html, /مدفوع بالكامل/)
  const arPartial = buildReceipt({ record, subject, locale: 'ar' })
  assert.ok(arPartial.ok)
  assert.match(arPartial.html, /مدفوع جزئياً/)
  assert.doesNotMatch(arPartial.html, /مدفوع بالكامل/)
})

test('a refund has no receipt', () => {
  assert.deepEqual(
    buildReceipt({ record: { ...record, direction: 'refunded' }, subject, locale: 'en' }),
    { ok: false, code: 'receipt_not_for_refund' },
  )
})

// ─── Single bookings (legacy bookings / trip_bookings rows) ───

type AccommodationSource = Extract<InvoiceSource, { kind: 'accommodation' }>['booking']

const accommodationBooking = {
  id: 'abcdef12-0000-4000-8000-000000000003',
  created_at: '2026-10-14T22:30:00Z',
  customer_name: 'Sara Test',
  customer_phone: '+201000000000',
  booking_type: 'accommodation-only' as const,
  payment_kind: 'stay' as const,
  num_people: 2,
  status: 'awaiting_payment' as const,
  total_price: 4000,
  amount_paid: 0,
  accommodations: { name_ar: 'مخيم', name_en: 'Camp' },
  price_snapshot: null,
}

function bookingDocument(type: 'request' | 'confirmation', amountPaid: number, locale: 'ar' | 'en' = 'en') {
  const data = buildInvoiceData(
    { kind: 'accommodation', booking: { ...accommodationBooking, amount_paid: amountPaid } as unknown as AccommodationSource },
    { type, locale, settings: null, now: new Date('2026-10-20T10:00:00Z') },
  )
  return { data, html: generateInvoiceHTML(data) }
}

test('a single booking: provisional quotation asks for nothing, confirmation asks for the deposit', () => {
  const quote = bookingDocument('request', 0)
  assert.match(quote.html, /<div class="doctitle">Provisional Quotation<\/div>/)
  assert.match(quote.html, /PROVISIONAL/)
  assert.doesNotMatch(quote.html, /Amount currently required/)
  assert.equal(quote.data.reference, bookingReference('BK', accommodationBooking.id))
  assert.equal(quote.data.reference, 'BK-ABCDEF12')

  const request = bookingDocument('confirmation', 0)
  assert.match(request.html, /Booking Confirmation &amp; Payment Request/)
  assert.match(request.html, /Amount currently required<\/td><td class="num">2,000\.00 EGP/)
  assert.match(request.html, /Balance due later — on arrival<\/td><td class="num">2,000\.00 EGP/)

  const afterDeposit = bookingDocument('confirmation', 2000)
  assert.match(afterDeposit.html, /Amount currently required<\/td><td class="num">0\.00 EGP/)
  assert.match(afterDeposit.html, /Received to date \(per our records\)/)
  assert.doesNotMatch(afterDeposit.html, /fully paid/i)
})

test('a standalone transfer is 100% after confirmation: no later balance', () => {
  const data = buildInvoiceData(
    {
      kind: 'accommodation',
      booking: {
        ...accommodationBooking, booking_type: 'transfer-only', payment_kind: 'transfer',
      } as unknown as AccommodationSource,
    },
    { type: 'confirmation', locale: 'en', settings: null, now: new Date('2026-10-20T10:00:00Z') },
  )
  const html = generateInvoiceHTML(data)
  assert.match(html, /Amount currently required<\/td><td class="num">4,000\.00 EGP/)
  assert.doesNotMatch(html, /Balance due later/)
})

// ─── Guarantees shared by every document ───

function quotationInput(overrides: Partial<QuotationInput> = {}): QuotationInput {
  return {
    reference: 'WR-2610-0001', revision_number: 1, is_current: true, status: 'checking_availability',
    availability_confirmed: false, created_at: '2026-10-14T09:30:00Z', customer_name: 'Nour Ahmed',
    journey, lines: quotationLines({ total: 12000, accommodation_subtotal: 12000 } as never), total: 12000,
    payment_plan: { rule: 'policy', upfrontPercent: 50, upfrontAmount: 6000, balanceAmount: 6000, balanceDue: 'on_arrival' },
    locale: 'en',
    ...overrides,
  }
}

function everyDocument(locale: 'ar' | 'en') {
  return {
    quotation: generateQuotationHTML(quotationInput({ locale })),
    confirmedQuotation: generateQuotationHTML(quotationInput({ locale, status: 'confirmed', availability_confirmed: true })),
    journeyConfirmation: built({ locale }).html,
    bookingQuotation: bookingDocument('request', 0, locale).html,
    bookingConfirmation: bookingDocument('confirmation', 0, locale).html,
    receipt: (() => {
      const result = buildReceipt({ record, subject, locale })
      assert.ok(result.ok)
      return result.html
    })(),
  }
}

for (const locale of ['en', 'ar'] as const) {
  test(`every ${locale} document: not-a-tax-invoice footer, embedded logo, correct direction, no "Invoice" title`, () => {
    const footer = locale === 'ar' ? NOT_TAX_INVOICE_AR : NOT_TAX_INVOICE_EN
    for (const [name, html] of Object.entries(everyDocument(locale))) {
      assert.ok(html.includes(`<div class="legal">${footer}</div>`), `${name}: footer`)
      assert.ok(html.includes(`src="${DOCUMENT_LOGO_DATA_URI}"`), `${name}: logo data URI`)
      assert.ok(DOCUMENT_LOGO_DATA_URI.startsWith('data:image/webp;base64,'))
      assert.ok(html.includes(`<html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}">`), `${name}: direction`)
      const title = (html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? ''
      const heading = (html.match(/<div class="doctitle">([^<]*)<\/div>/) ?? [])[1] ?? ''
      assert.ok(title && heading, `${name}: has a title`)
      assert.doesNotMatch(`${title} ${heading}`, /invoice|فاتورة/i, `${name}: title`)
      assert.doesNotMatch(html, /NaN|undefined/, `${name}: no NaN/undefined`)
      assert.match(html, /WEEMAP SINAI/, `${name}: brand`)
    }
  })
}

test('Arabic documents are right-to-left and English ones are not', () => {
  for (const html of Object.values(everyDocument('ar'))) assert.ok(html.includes('dir="rtl"'))
  for (const html of Object.values(everyDocument('en'))) assert.equal(html.includes('dir="rtl"'), false)
})

test('document titles are the approved names', () => {
  const en = everyDocument('en')
  assert.match(en.quotation, /<div class="doctitle">Provisional Quotation<\/div>/)
  assert.match(en.journeyConfirmation, /<div class="doctitle">Booking Confirmation &amp; Payment Request<\/div>/)
  assert.match(en.receipt, /<div class="doctitle">Payment Receipt<\/div>/)
  const ar = everyDocument('ar')
  assert.match(ar.quotation, /<div class="doctitle">عرض سعر مبدئي<\/div>/)
  assert.match(ar.journeyConfirmation, /<div class="doctitle">تأكيد الحجز وطلب الدفع<\/div>/)
  assert.match(ar.receipt, /<div class="doctitle">إيصال دفع<\/div>/)
})

test('print CSS is present and rows do not split across pages', () => {
  const { journeyConfirmation } = everyDocument('en')
  assert.match(journeyConfirmation, /@page \{ size: A4/)
  assert.match(journeyConfirmation, /@media print/)
  assert.match(journeyConfirmation, /break-inside: avoid/)
})
