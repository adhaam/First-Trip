/**
 * "Booking Confirmation & Payment Request" for a Build-Your-Trip journey (a
 * trip_requests row), rendered on the shared branded template.
 *
 * Issued only when supplier availability is confirmed — the request is in
 * awaiting_payment / confirmed / completed (isAvailabilityConfirmedStatus).
 * Before that the only customer document is the Provisional Quotation, and this
 * builder refuses with `availability_not_confirmed`.
 *
 * What is required now / later comes from the journey's payment plan:
 *   paymentPlan(journeyPaymentKind(row), agreedTotal, policies)
 * — a trips-only journey is 100% after confirmation, every other journey 50% after
 * confirmation / 50% on arrival — less the amount the ledger has received.
 * The journey is the sole commercial owner: its component bookings never get
 * their own documents.
 */
import {
  DEFAULT_PAYMENT_POLICIES, journeyPaymentKind, paymentPlan,
  type PaymentMethod, type PaymentPolicy,
} from '@/lib/payment-rules'
import {
  journeyFactsSection, journeyLinesSection,
  type QuotationJourney, type QuotationLine,
} from '@/lib/quotation-document'
import type { SiteSettings } from '@/lib/types'
import { isAvailabilityConfirmedStatus } from '@/lib/trip-requests/amend'
import { cairoDate, DOCUMENT_TITLES, pick, type DocLocale } from './format'
import { computePaymentDue, type PaymentDue } from './payment-due'
import { customerSection, noteSection, paymentMethodsSection, paymentRequestSummary, termsSection } from './sections'
import { renderDocument, resolveContact } from './template'

export type JourneyConfirmationInput = {
  reference: string
  /** trip_requests.status */
  status: string
  customer_name: string
  customer_phone?: string | null
  customer_email?: string | null
  /** The current revision number. */
  revision_number: number
  /** transport_mode / accommodation_id decide the payment kind via journeyPaymentKind. */
  journey_row: { transport_mode?: string | null; accommodation_id?: string | null }
  journey: QuotationJourney
  /** Reconciled to `total` (quotationLines adds an adjustment line for any gap). */
  lines: QuotationLine[]
  /** Agreed total: agreed_total ?? quoted_total. */
  total: number
  /** trip_requests.amount_paid — the ledger-derived figure. */
  amount_paid: number
  policies?: readonly PaymentPolicy[]
  payment_methods?: readonly PaymentMethod[]
  notes?: string | null
  settings?: SiteSettings | null
  /** The issue moment, injected so the output is deterministic. */
  now?: Date
  locale: DocLocale
}

export type JourneyConfirmationResult =
  | { ok: true; html: string; documentNumber: string; due: PaymentDue }
  | { ok: false; code: 'availability_not_confirmed' }

export function journeyConfirmationNumber(reference: string, revision: number): string {
  return `${reference}-CONF-R${revision}`
}

export function buildJourneyConfirmation(input: JourneyConfirmationInput): JourneyConfirmationResult {
  if (!isAvailabilityConfirmedStatus(input.status)) return { ok: false, code: 'availability_not_confirmed' }

  const locale = input.locale
  const t = (en: string, ar: string) => (locale === 'ar' ? ar : en)
  const contact = resolveContact(input.settings, locale)
  const plan = paymentPlan(
    journeyPaymentKind(input.journey_row),
    input.total,
    input.policies ?? DEFAULT_PAYMENT_POLICIES,
  )
  const due = computePaymentDue({ total: input.total, amountPaid: input.amount_paid, plan })
  const documentNumber = journeyConfirmationNumber(input.reference, input.revision_number)

  const body = [
    customerSection(locale, { name: input.customer_name, phone: input.customer_phone, email: input.customer_email }),
    journeyFactsSection(input.journey, locale),
    journeyLinesSection(input.lines, locale),
    paymentRequestSummary(locale, due),
    paymentMethodsSection(locale, input.payment_methods ?? [], contact, input.reference),
    noteSection(locale, input.notes),
    termsSection(locale, input.settings),
  ].join('\n')

  const html = renderDocument({
    locale,
    kind: 'booking_confirmation',
    title: pick(DOCUMENT_TITLES.booking_confirmation, locale),
    documentNumber,
    issueDate: cairoDate(input.now ?? new Date()),
    issueDateLabel: t('Issued', 'تاريخ الإصدار'),
    meta: [
      [t('Reference', 'المرجع'), input.reference],
      [t('Revision', 'المراجعة'), String(input.revision_number)],
    ],
    banners: [{
      tone: 'success',
      text: t(
        'Availability for your journey has been confirmed. Please complete the payment requested below to secure it.',
        'تم تأكيد توفر رحلتك. يرجى إتمام الدفع المطلوب أدناه لتثبيتها.',
      ),
    }],
    body,
    contact,
  })
  return { ok: true, html, documentNumber, due }
}
