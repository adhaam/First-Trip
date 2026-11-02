/**
 * "Payment Receipt" — rendered from ONE real payment_records row.
 *
 * A receipt exists only for money that was actually received: a 'received'
 * ledger entry. It is never derived from an expected amount, a payment plan or
 * a booking's amount_paid. A 'refunded' entry has no receipt
 * (`receipt_not_for_refund`).
 *
 * The receipt number is a pure function of the record (Cairo date of
 * received_at + the record id), so a transaction can never have two different
 * receipts however often it is printed.
 *
 * Figures shown are the ledger's own: the amount of this payment, and the
 * running total received AS AT this payment (amount_paid_after) against the
 * booking total. "Fully paid" appears only when amount_paid_after >= total.
 */
import type { SiteSettings } from '@/lib/types'
import {
  amountOf, cairoCompactDate, cairoDate, cairoDateTime, cents, DOCUMENT_TITLES, formatMoney,
  paymentMethodLabel, pick, type DocLocale,
} from './format'
import { callout, kvTable, renderDocument, resolveContact, section, summaryTable, type Cell } from './template'

/** The columns of a payment_records row the receipt reads. */
export type ReceiptRecord = {
  id: string
  entity_type: string
  entity_id: string
  direction: string
  amount: number | string
  method: string
  reference?: string | null
  received_at: string
  amount_paid_after: number | string
}

/** The thing that was paid for: its reference, customer and agreed total. */
export type ReceiptSubject = {
  /** WR-… / BK-… / TB-… / SG-… / order number */
  reference: string
  customer_name: string
  customer_phone?: string | null
  total: number
  /** What the payment is for (stay name, trip name), when known. */
  title_en?: string | null
  title_ar?: string | null
}

export type ReceiptStatus = 'partial' | 'full'

/** RC-<Cairo YYYYMMDD of received_at>-<first 8 chars of the record id, uppercased>. */
export function receiptNumber(record: Pick<ReceiptRecord, 'id' | 'received_at'>): string {
  const idPart = String(record.id).replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase()
  return `RC-${cairoCompactDate(record.received_at)}-${idPart}`
}

/** Fully paid only when the money received as at this payment reaches the booking total. */
export function receiptStatus(amountPaidAfter: number, total: number): ReceiptStatus {
  return cents(amountPaidAfter) >= cents(total) ? 'full' : 'partial'
}

export type ReceiptInput = {
  record: ReceiptRecord
  subject: ReceiptSubject
  settings?: SiteSettings | null
  locale: DocLocale
}

export type ReceiptResult =
  | { ok: true; html: string; documentNumber: string; status: ReceiptStatus; remaining: number }
  | { ok: false; code: 'receipt_not_for_refund' | 'receipt_not_for_direction' }

export function buildReceipt(input: ReceiptInput): ReceiptResult {
  const { record, subject, locale } = input
  if (record.direction === 'refunded') return { ok: false, code: 'receipt_not_for_refund' }
  if (record.direction !== 'received') return { ok: false, code: 'receipt_not_for_direction' }

  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en)
  const documentNumber = receiptNumber(record)
  const amount = amountOf(record.amount)
  const paidAfter = amountOf(record.amount_paid_after)
  const total = amountOf(subject.total)
  const remaining = Math.max(0, (cents(total) - cents(paidAfter)) / 100)
  const status = receiptStatus(paidAfter, total)
  const statusText = status === 'full'
    ? t('Fully paid', 'مدفوع بالكامل')
    : t('Partially paid', 'مدفوع جزئياً')
  const title = locale === 'ar' ? subject.title_ar || subject.title_en : subject.title_en || subject.title_ar

  const subjectRows: Array<[string, Cell]> = [
    [t('Booking reference', 'مرجع الحجز'), subject.reference],
    [t('Customer', 'العميل'), subject.customer_name],
  ]
  if (title) subjectRows.push([t('For', 'عن'), title])

  const paymentRows: Array<[string, Cell]> = [
    [t('Payment date', 'تاريخ الدفع'), cairoDateTime(record.received_at, locale)],
    [t('Payment method', 'طريقة الدفع'), paymentMethodLabel(record.method, locale)],
  ]
  if (record.reference) paymentRows.push([t('Transaction reference', 'مرجع المعاملة'), record.reference])

  const body = [
    section(t('Booking', 'الحجز'), kvTable(subjectRows)),
    section(t('Payment', 'الدفعة'), kvTable(paymentRows)),
    summaryTable([
      { label: t('Amount received', 'المبلغ المستلم'), value: formatMoney(amount, locale), tone: 'due' },
      {
        label: t('Total received to date (as at this payment)', 'إجمالي المستلم حتى هذه الدفعة'),
        value: formatMoney(paidAfter, locale),
        tone: 'muted',
      },
      { label: t('Booking total', 'إجمالي الحجز'), value: formatMoney(total, locale), tone: 'total' },
      { label: t('Remaining balance', 'الرصيد المتبقي'), value: formatMoney(remaining, locale), tone: 'muted' },
    ]),
    callout(
      status === 'full' ? 'success' : 'info',
      t('Payment status', 'حالة الدفع'),
      statusText,
    ),
  ].join('\n')

  const html = renderDocument({
    locale,
    kind: 'payment_receipt',
    title: pick(DOCUMENT_TITLES.payment_receipt, locale),
    documentNumber,
    issueDate: cairoDate(record.received_at),
    issueDateLabel: t('Date', 'التاريخ'),
    meta: [[t('Booking reference', 'مرجع الحجز'), subject.reference]],
    body,
    contact: resolveContact(input.settings, locale),
  })
  return { ok: true, html, documentNumber, status, remaining }
}
