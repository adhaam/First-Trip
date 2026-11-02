import type { PaymentMethod, PaymentPlan } from '@/lib/payment-rules'
import type { SiteSettings } from '@/lib/types'
import { DOCUMENT_TITLES, formatMoney, pick } from '@/lib/documents/format'
import { computePaymentDue } from '@/lib/documents/payment-due'
import {
  customerSection, noteSection, paymentMethodsSection, paymentRequestSummary, paymentTermsSection, termsSection,
} from '@/lib/documents/sections'
import {
  chargesTable, kvTable, renderDocument, resolveContact, section, summaryTable,
  type SummaryRow,
} from '@/lib/documents/template'

// ─── Customer documents for single bookings (bookings / trip_bookings) ───
//
// Not an invoice and never titled one. A single booking gets exactly two
// documents, both rendered on the shared branded template (lib/documents):
//
//   type 'request'      → "Provisional Quotation": before supplier
//                          availability is confirmed. Clearly provisional;
//                          asks for no payment.
//   type 'confirmation' → "Booking Confirmation & Payment Request": only once
//                          availability is confirmed (the route enforces it).
//                          States what is required NOW and what falls due
//                          LATER, from the payment plan and the ledger figure.
//
// (The generator's names keep "Invoice" for import compatibility only.)

/**
 * One "what did I book" fact, shown above the charges table. Bilingual pairs
 * rather than keys, because a value can be a translated label (a room type,
 * a transfer direction) as easily as a raw number.
 */
export interface InvoiceDetail {
  label_ar: string
  label_en: string
  value_ar: string
  value_en: string
}

export interface InvoiceAdjustment {
  label_ar: string
  label_en: string
  /** Signed: negative = deducted, positive = added. */
  amount: number
}

/**
 * Every value interpolated below that is not a literal of this template is
 * escaped: customer name/phone/email/notes come straight from the public
 * booking form, names and labels from the database, terms from
 * site_settings. The rendered HTML is shown in the admin dashboard, so an
 * unescaped `<img onerror>` in a booking name would run with admin rights.
 */
export interface InvoiceData {
  /** 'request' = Provisional Quotation, 'confirmation' = Booking Confirmation & Payment Request. */
  type: 'request' | 'confirmation'
  /** The document number (kept under its historical name). */
  invoiceNumber: string
  /** The booking's own reference (BK-… / TB-…), shown under the title. */
  reference?: string
  /** Issue date, already formatted in Africa/Cairo. Falls back to orderDate. */
  issueDate?: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  orderDate: string
  /**
   * The booking's own facts — party size, dates, transfer type and
   * direction, room and nights, meal plan. Without these an invoice shows a
   * price with nothing to justify it, which is exactly how a 5-person
   * transfer-only booking ended up reading as "Accommodation, qty 2".
   */
  details?: InvoiceDetail[]
  items: Array<{
    description_ar: string
    description_en: string
    quantity: number
    unitPrice: number
    /** How the amount was reached, e.g. "5 people x 950 EGP x 2 legs". */
    meta_ar?: string
    meta_en?: string
  }>
  subtotal: number
  deliveryFee?: number
  /** Shown as its own deducted row when a discount applied to this booking. */
  discount?: { label_ar: string; label_en: string; amount: number }
  /**
   * Signed summary rows between the subtotal and the total — a negative
   * amount is a deduction (a discount), a positive one a surcharge (an agreed
   * price above the itemised one). Built by lib/invoice-items so that
   * subtotal + Σ adjustments === totalAmount, always.
   */
  adjustments?: InvoiceAdjustment[]
  /** Ignored: what is due now comes from paymentPlan and the ledger, never from a stored deposit. */
  depositAmount?: number
  totalAmount: number
  /** Received so far per the ledger — drives "received to date" and the due-now / due-later split. */
  amountPaid?: number
  /** From paymentPlan(paymentKindFor(row), total, policies). Absent → the amount is "agreed with the team". */
  paymentPlan?: PaymentPlan | null
  /** Active payment methods (payment-rules-load). */
  paymentMethods?: readonly PaymentMethod[]
  notes?: string
  locale: 'ar' | 'en'
  settings: SiteSettings | null
}


export function generateInvoiceHTML(data: InvoiceData): string {
  const locale = data.locale
  const ar = locale === 'ar'
  const t = (en: string, arText: string) => (ar ? arText : en)
  const confirmed = data.type === 'confirmation'
  const title = pick(DOCUMENT_TITLES[confirmed ? 'booking_confirmation' : 'provisional_quotation'], locale)
  const reference = data.reference ?? data.invoiceNumber
  const contact = resolveContact(data.settings, locale)

  const details = (data.details ?? []).map((d): [string, string] => [
    ar ? d.label_ar : d.label_en,
    ar ? d.value_ar : d.value_en,
  ])
  const detailsBlock = details.length === 0 ? '' : section(
    t('Booking details', 'تفاصيل الحجز'),
    kvTable(details),
  )

  const charges = section(
    t('Services', 'الخدمات'),
    chargesTable(
      { description: t('Description', 'الوصف'), quantity: t('Qty', 'الكمية'), unit: t('Price', 'السعر'), total: t('Total', 'الإجمالي') },
      data.items.map((item) => ({
        description: ar ? item.description_ar : item.description_en,
        meta: (ar ? item.meta_ar : item.meta_en) || undefined,
        quantity: item.quantity,
        unit: formatMoney(item.unitPrice, locale),
        total: formatMoney(Number(item.quantity) * Number(item.unitPrice), locale),
      })),
      true,
    ),
  )

  // Rows between the itemised lines and the agreed total.
  const preRows: SummaryRow[] = [{ label: t('Subtotal', 'الإجمالي الفرعي'), value: formatMoney(data.subtotal, locale), tone: 'muted' }]
  if (data.deliveryFee) {
    preRows.push({ label: t('Delivery fee', 'رسوم التوصيل'), value: formatMoney(data.deliveryFee, locale), tone: 'muted' })
  }
  if (data.discount && data.discount.amount > 0 && !(data.adjustments?.length)) {
    preRows.push({
      label: ar ? data.discount.label_ar : data.discount.label_en,
      value: `− ${formatMoney(data.discount.amount, locale)}`,
      tone: 'credit',
    })
  }
  for (const adjustment of data.adjustments ?? []) {
    const amount = Number(adjustment.amount)
    if (Math.abs(amount) < 0.005) continue
    preRows.push({
      label: ar ? adjustment.label_ar : adjustment.label_en,
      value: `${amount < 0 ? '−' : '+'} ${formatMoney(Math.abs(amount), locale)}`,
      tone: amount < 0 ? 'credit' : 'muted',
    })
  }

  let totals: string
  let payment: string
  if (confirmed) {
    const due = computePaymentDue({ total: data.totalAmount, amountPaid: data.amountPaid ?? 0, plan: data.paymentPlan })
    totals = paymentRequestSummary(locale, due, preRows)
    payment = paymentMethodsSection(locale, data.paymentMethods ?? [], contact, reference)
  } else {
    totals = summaryTable([
      ...preRows,
      { label: t('Estimated total', 'الإجمالي المبدئي'), value: formatMoney(data.totalAmount, locale), tone: 'total' },
    ])
    payment = paymentTermsSection(locale, data.paymentPlan)
  }

  const banners = confirmed
    ? [{
        tone: 'success' as const,
        text: t(
          'Availability for your booking has been confirmed. Please complete the payment requested below to secure it.',
          'تم تأكيد توفر حجزك. يرجى إتمام الدفع المطلوب أدناه لتثبيته.',
        ),
      }]
    : [{
        tone: 'provisional' as const,
        text: t(
          'PROVISIONAL — subject to supplier availability. This is not a confirmation of your booking and no payment is requested yet.',
          'مبدئي — رهن تأكيد التوفر من المورد. هذا ليس تأكيدًا لحجزك ولا يُطلب أي دفع حاليًا.',
        ),
      }]

  const body = [
    customerSection(locale, { name: data.customerName, phone: data.customerPhone, email: data.customerEmail }),
    detailsBlock,
    charges,
    totals,
    payment,
    noteSection(locale, data.notes),
    termsSection(locale, data.settings),
  ].join('\n')

  return renderDocument({
    locale,
    kind: confirmed ? 'booking_confirmation' : 'provisional_quotation',
    title,
    documentNumber: data.invoiceNumber,
    issueDate: data.issueDate ?? data.orderDate,
    issueDateLabel: t('Issued', 'تاريخ الإصدار'),
    meta: [[t('Reference', 'المرجع'), reference]],
    banners,
    body,
    contact,
  })
}

/** The same renderer under a name that says what it produces. */
export const generateBookingDocumentHTML = generateInvoiceHTML
