import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cairoDay,
  generateQuotationHTML,
  isQuotationConfirmed,
  quotationLines,
  QUOTATION_DISCLAIMER_AR,
  QUOTATION_DISCLAIMER_EN,
  QUOTATION_FOOTER_DISCLAIMER_AR,
  QUOTATION_FOOTER_DISCLAIMER_EN,
  type QuotationInput,
} from './quotation-document'
import type { PriceSnapshot } from './types'

const snapshot: PriceSnapshot = {
  nights: 4,
  num_people: 3,
  accommodation_subtotal: 6000,
  transfer_subtotal: 1800,
  meal_subtotal: 900,
  extra_trips: [{ trip_id: 't1', name_en: 'Blue Hole', price: 400 }],
  extra_trips_subtotal: 1200,
  trip_packages: [{ package_id: 'p1', name_en: 'Sinai Classic', trip_names_en: ['A', 'B'], total: 2500 }],
  trip_packages_subtotal: 2500,
  total: 12400,
  computed_at: '2026-10-10T00:00:00Z',
}

const sum = (lines: { amount: number }[]) => lines.reduce((s, l) => s + l.amount, 0)

test('quotationLines itemises the snapshot and sums to its total', () => {
  const lines = quotationLines(snapshot)
  assert.deepEqual(lines.map((l) => l.key), ['accommodation', 'transfer', 'meals', 'trip:t1', 'package:p1'])
  assert.equal(lines.find((l) => l.key === 'trip:t1')?.amount, 1200)
  assert.equal(sum(lines), snapshot.total)
  assert.ok(lines.every((l) => l.label_en && l.label_ar))
})

test('quotationLines uses supplied bilingual names', () => {
  const lines = quotationLines(snapshot, {
    trips: { t1: { name_en: 'Blue Hole', name_ar: 'البلو هول' } },
    packages: { p1: { name_en: 'Sinai Classic', name_ar: 'سيناء الكلاسيكية' } },
  })
  assert.equal(lines.find((l) => l.key === 'trip:t1')?.label_ar, 'البلو هول')
  assert.equal(lines.find((l) => l.key === 'package:p1')?.label_ar, 'سيناء الكلاسيكية')
})

test('quotationLines never hides a gap: a mismatch becomes an explicit adjustment line', () => {
  const overridden = quotationLines({ ...snapshot, total: 11000 })
  const adjustment = overridden.find((l) => l.key === 'adjustment')
  assert.equal(adjustment?.amount, -1400)
  assert.equal(adjustment?.label_en, 'Other / adjustment')
  assert.equal(sum(overridden), 11000)
  assert.equal(quotationLines({ ...snapshot, total: 12400 }).some((l) => l.key === 'adjustment'), false)
  // Unknown party size: experiences collapse to the snapshot subtotal and the lines still balance.
  const noPeople = quotationLines({ ...snapshot, num_people: undefined })
  assert.equal(noPeople.some((l) => l.key === 'extra_trips'), true)
  assert.equal(sum(noPeople), snapshot.total)
  assert.deepEqual(quotationLines(null), [])
})

test('quotationLines tolerates float noise without inventing an adjustment', () => {
  const lines = quotationLines({
    ...snapshot, accommodation_subtotal: 0.1 + 0.2, transfer_subtotal: 0, meal_subtotal: 0,
    extra_trips: [], extra_trips_subtotal: 0, trip_packages: [], total: 0.3,
  })
  assert.deepEqual(lines.map((l) => l.key), ['accommodation'])
})

function input(overrides: Partial<QuotationInput> = {}): QuotationInput {
  return {
    reference: 'WR-2610-0001',
    revision_number: 2,
    is_current: true,
    superseded_by: null,
    status: 'awaiting_payment',
    availability_confirmed: true,
    created_at: '2026-10-14T09:30:00Z',
    customer_name: 'Nour Ahmed',
    journey: {
      arrival_date: '2026-11-06', departure_date: '2026-11-10', nights: 4, adults: 2, children: 1,
      transport_mode: 'hiace', origin: { name_en: 'Cairo', name_ar: 'القاهرة' },
      stay: { name_en: 'Blue Lagoon Camp', name_ar: 'مخيم بلو لاجون' },
      rooms: [{ type: 'double', count: 1 }, { type: 'single', count: 1 }],
      meal_plan: { name_en: 'Half board', name_ar: 'إفطار وعشاء' },
      experiences: [{ name_en: 'Blue Hole', name_ar: 'البلو هول' }],
    },
    lines: quotationLines(snapshot),
    total: 12400,
    previous_total: 10000,
    difference: 2400,
    payment_plan: {
      rule: 'policy', upfrontPercent: 50, upfrontAmount: 6200, balanceAmount: 6200, balanceDue: 'on_arrival',
    },
    locale: 'en',
    ...overrides,
  }
}

/** Removes the sentences that are allowed to contain the word "invoice". */
function withoutDisclaimers(html: string): string {
  return [
    QUOTATION_DISCLAIMER_EN, QUOTATION_DISCLAIMER_AR, QUOTATION_FOOTER_DISCLAIMER_EN, QUOTATION_FOOTER_DISCLAIMER_AR,
  ].reduce((text, sentence) => text.split(sentence).join(''), html)
}

test('a confirmed, current English quotation has no banners and shows the revision', () => {
  const html = generateQuotationHTML(input())
  assert.match(html, /<html lang="en" dir="ltr">/)
  assert.match(html, /<h1>Quotation<\/h1>/)
  assert.match(html, /Revision 2/)
  assert.match(html, /WR-2610-0001/)
  assert.equal(html.includes('PROVISIONAL'), false)
  assert.equal(html.includes('SUPERSEDED'), false)
  assert.ok(html.includes(QUOTATION_FOOTER_DISCLAIMER_EN))
  assert.equal(isQuotationConfirmed('awaiting_payment', true), true)
})

test('payment terms, previous total and difference are shown with en-US grouping', () => {
  const html = generateQuotationHTML(input())
  assert.match(html, /50% after confirmation/)
  assert.match(html, /50% on arrival/)
  assert.match(html, /6,200 EGP/)
  assert.match(html, /12,400 EGP/)
  assert.match(html, /Previous total/)
  assert.match(html, /10,000 EGP/)
  assert.match(html, /\+2,400 EGP/)
  const lower = generateQuotationHTML(input({ difference: -300, previous_total: 12700 }))
  assert.match(lower, /-300 EGP/)
  const first = generateQuotationHTML(input({ previous_total: null, difference: null, revision_number: 1 }))
  assert.equal(first.includes('Previous total'), false)
})

test('a request whose availability is not confirmed is PROVISIONAL', () => {
  const banner = 'PROVISIONAL — subject to supplier availability. Not a confirmation or a tax invoice.'
  for (const status of ['new', 'checking_availability', 'alternatives_required', 'cancelled']) {
    const html = generateQuotationHTML(input({ status, availability_confirmed: false }))
    assert.ok(html.includes(banner), status)
    assert.equal(html.includes(QUOTATION_FOOTER_DISCLAIMER_EN), false)
  }
  // Either signal alone is enough.
  assert.ok(generateQuotationHTML(input({ status: 'checking_availability' })).includes('PROVISIONAL'))
  assert.ok(generateQuotationHTML(input({ availability_confirmed: false })).includes('PROVISIONAL'))
  for (const status of ['awaiting_payment', 'confirmed', 'completed']) {
    assert.equal(generateQuotationHTML(input({ status })).includes('PROVISIONAL'), false, status)
  }
})

test('a superseded revision says which revision replaced it', () => {
  const html = generateQuotationHTML(input({ revision_number: 1, is_current: false, superseded_by: 2 }))
  assert.ok(html.includes('SUPERSEDED by revision 2'))
  assert.ok(html.includes('Revision 1'))
  const generic = generateQuotationHTML(input({ is_current: false, superseded_by: null }))
  assert.ok(generic.includes('SUPERSEDED by a later revision'))
  const ar = generateQuotationHTML(input({ revision_number: 1, is_current: false, superseded_by: 3, locale: 'ar' }))
  assert.ok(ar.includes('تم استبداله بالمراجعة رقم 3'))
})

test('the Arabic quotation is right-to-left and uses Arabic copy', () => {
  const html = generateQuotationHTML(
    input({ locale: 'ar', status: 'checking_availability', availability_confirmed: false }),
  )
  assert.match(html, /<html lang="ar" dir="rtl">/)
  assert.match(html, /<h1>عرض سعر<\/h1>/)
  assert.ok(html.includes('المراجعة رقم 2'))
  assert.ok(html.includes(
    'مبدئي — رهن تأكيد التوفر من المورد. ليس تأكيدًا للحجز ولا فاتورة ضريبية.',
  ))
  assert.ok(html.includes('مخيم بلو لاجون'))
  assert.ok(html.includes('البلو هول'))
  assert.ok(html.includes('12,400 ج.م'))
  assert.equal(generateQuotationHTML(input()).includes('dir="rtl"'), false)
})

test('the word invoice appears only inside the not-a-tax-invoice disclaimer', () => {
  const variants = [
    input(),
    input({ locale: 'ar' }),
    input({ status: 'new', availability_confirmed: false }),
    input({ status: 'new', availability_confirmed: false, locale: 'ar' }),
    input({ is_current: false, superseded_by: 3 }),
    input({ is_current: false, superseded_by: 3, locale: 'ar', status: 'confirmed' }),
  ]
  for (const variant of variants) {
    const html = generateQuotationHTML(variant)
    assert.ok(/invoice/i.test(html) || /فاتورة/.test(html), 'the disclaimer is always present')
    const rest = withoutDisclaimers(html)
    assert.equal(/invoice/i.test(rest), false, 'English: invoice outside the disclaimer')
    assert.equal(/فاتورة/.test(rest), false, 'Arabic: invoice outside the disclaimer')
  }
})

test('customer-controlled text is escaped', () => {
  const evil = '<img src=x onerror=alert(1)> & "Co"'
  const html = generateQuotationHTML(input({
    customer_name: evil,
    reference: '<b>WR</b>',
    journey: { ...input().journey, stay: { name_en: '<script>alert(2)</script>', name_ar: 'x' } },
    lines: [{ key: 'x', label_en: '<i>line</i>', label_ar: 'x', amount: 5 }],
  }))
  assert.equal(html.includes('<img src=x'), false)
  assert.equal(html.includes('<script>alert'), false)
  assert.equal(html.includes('<b>WR</b>'), false)
  assert.equal(html.includes('<i>line</i>'), false)
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt; &amp; &quot;Co&quot;'))
})

test('a plan without an upfront split says terms are agreed with the team', () => {
  const html = generateQuotationHTML(input({ payment_plan: { rule: 'per_quote', upfrontAmount: null } }))
  assert.match(html, /Payment terms are agreed with the team/)
  assert.equal(generateQuotationHTML(input({ payment_plan: null })).includes('Payment terms'), false)
})

test('the issue date is the Cairo calendar day, not the UTC one', () => {
  assert.equal(cairoDay('2026-10-14T22:48:58Z'), '2026-10-15')
  assert.equal(cairoDay('2026-10-14T09:30:00Z'), '2026-10-14')
})
