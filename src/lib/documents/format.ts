/**
 * Shared formatting for the customer documents (provisional quotation,
 * booking confirmation & payment request, payment receipt).
 *
 * Pure and free of server imports so every document can be unit-tested. All
 * dates are rendered in Africa/Cairo — the timezone the business operates in —
 * never UTC and never the server's local zone.
 */

export type DocLocale = 'ar' | 'en'

export const DOCUMENT_TIME_ZONE = 'Africa/Cairo'

export const NOT_TAX_INVOICE_EN = 'This document is not a tax invoice.'
export const NOT_TAX_INVOICE_AR = 'هذا المستند ليس فاتورة ضريبية.'

export function notTaxInvoice(locale: DocLocale): string {
  return locale === 'ar' ? NOT_TAX_INVOICE_AR : NOT_TAX_INVOICE_EN
}

/** A DB numeric that may arrive as number, numeric string or null. Non-finite becomes 0. */
export function amountOf(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** Money in whole piastres, so comparisons never trip over float noise. */
export function cents(value: number): number {
  return Math.round((amountOf(value) + Number.EPSILON) * 100)
}

export function fromCents(value: number): number {
  return value / 100
}

/** "4,800.00 EGP" / "4,800.00 ج.م". Number() first so a stray string cannot inject. */
export function formatMoney(value: unknown, locale: DocLocale): string {
  const n = amountOf(value)
  const text = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${text} ${locale === 'ar' ? 'ج.م' : 'EGP'}`
}

function parts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of new Intl.DateTimeFormat('en-GB', { timeZone: DOCUMENT_TIME_ZONE, ...options }).formatToParts(date)) {
    out[part.type] = part.value
  }
  return out
}

function validDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The Cairo calendar day of an instant as YYYY-MM-DD (01:30 Cairo is still "today" there). */
export function cairoDate(value: string | Date | null | undefined): string {
  const date = validDate(value)
  if (!date) return typeof value === 'string' ? value.slice(0, 10) : ''
  const p = parts(date, { year: 'numeric', month: '2-digit', day: '2-digit' })
  return `${p.year}-${p.month}-${p.day}`
}

/** The Cairo calendar day as YYYYMMDD, for document numbers. */
export function cairoCompactDate(value: string | Date | null | undefined): string {
  return cairoDate(value).replace(/-/g, '')
}

/** "2026-09-01 02:30 (Cairo time)" — the actual wall-clock moment in Cairo. */
export function cairoDateTime(value: string | Date | null | undefined, locale: DocLocale): string {
  const date = validDate(value)
  if (!date) return typeof value === 'string' ? value : ''
  const p = parts(date, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const zone = locale === 'ar' ? 'بتوقيت القاهرة' : 'Cairo time'
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} (${zone})`
}

/** A stored calendar day (a trip / arrival date) shown as YYYY-MM-DD with no timezone shift. */
export function calendarDay(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : ''
}

export type Bilingual = { en: string; ar: string }

export function pick(text: Bilingual, locale: DocLocale): string {
  return locale === 'ar' ? text.ar : text.en
}

export type DocumentKind = 'provisional_quotation' | 'booking_confirmation' | 'payment_receipt'

export const DOCUMENT_TITLES: Record<DocumentKind, Bilingual> = {
  provisional_quotation: { en: 'Provisional Quotation', ar: 'عرض سعر مبدئي' },
  booking_confirmation: { en: 'Booking Confirmation & Payment Request', ar: 'تأكيد الحجز وطلب الدفع' },
  payment_receipt: { en: 'Payment Receipt', ar: 'إيصال دفع' },
}

/** Payment method labels (payment_records.method) for the receipt. */
export const PAYMENT_METHOD_LABELS: Record<string, Bilingual> = {
  instapay: { en: 'InstaPay', ar: 'إنستاباي' },
  vodafonecash: { en: 'Vodafone Cash', ar: 'فودافون كاش' },
  cash: { en: 'Cash', ar: 'كاش' },
  bank_transfer: { en: 'Bank transfer', ar: 'تحويل بنكي' },
  card_link: { en: 'Visa / Mastercard payment link', ar: 'رابط دفع فيزا / ماستركارد' },
  other: { en: 'Other', ar: 'أخرى' },
}

export function paymentMethodLabel(code: string, locale: DocLocale): string {
  const known = PAYMENT_METHOD_LABELS[code]
  return known ? pick(known, locale) : code
}
