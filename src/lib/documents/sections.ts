/**
 * Body sections shared by the booking and journey documents, built from the
 * template fragments. Each takes plain facts and returns an escaped fragment.
 */
import type { PaymentMethod } from '@/lib/payment-rules'
import { escapeHtml as esc } from '@/lib/safe-html'
import type { SiteSettings } from '@/lib/types'
import { formatMoney, type DocLocale } from './format'
import type { PaymentDue } from './payment-due'
import {
  bulletList, callout, kvTable, paragraphs, section, summaryTable,
  type Cell, type DocumentContact, type SummaryRow,
} from './template'

const t = (locale: DocLocale, en: string, ar: string) => (locale === 'ar' ? ar : en)

export function customerSection(
  locale: DocLocale,
  customer: { name: string; phone?: string | null; email?: string | null },
): string {
  const ltr = (value: string): Cell => ({
    html: `<span style="direction:ltr;unicode-bidi:isolate;display:inline-block">${esc(value)}</span>`,
  })
  const rows: Array<[string, Cell]> = [[t(locale, 'Name', 'الاسم'), customer.name]]
  if (customer.phone) rows.push([t(locale, 'Phone', 'الهاتف'), ltr(customer.phone)])
  if (customer.email) rows.push([t(locale, 'Email', 'البريد الإلكتروني'), ltr(customer.email)])
  return section(t(locale, 'Prepared for', 'أُعد لـ'), kvTable(rows))
}

export type PlanTerms = {
  rule?: string | null
  upfrontPercent?: number | null
  upfrontAmount?: number | null
  balanceAmount?: number | null
  balanceDue?: string | null
}

export function laterTimingText(locale: DocLocale, timing: string | null | undefined): string {
  return timing === 'before_service'
    ? t(locale, 'before the service', 'قبل الخدمة')
    : t(locale, 'on arrival', 'عند الوصول')
}

/** The expected payment split on a provisional quotation (no amounts are being requested yet). */
export function paymentTermsSection(locale: DocLocale, plan: PlanTerms | null | undefined): string {
  if (!plan) return ''
  const heading = t(locale, 'Payment terms', 'شروط الدفع')
  if (plan.upfrontAmount === null || plan.upfrontAmount === undefined) {
    return section(heading, paragraphs(t(
      locale,
      'Payment terms are agreed with the team for this quotation.',
      'يتم الاتفاق على شروط الدفع مع الفريق لهذا العرض.',
    )))
  }
  const percent = plan.upfrontPercent ?? null
  const balance = plan.balanceAmount ?? 0
  const rows: Array<[string, Cell]> = [[
    `${percent !== null ? `${percent}% ` : ''}${t(locale, 'after confirmation', 'بعد التأكيد')}`,
    formatMoney(plan.upfrontAmount, locale),
  ]]
  if (balance > 0) {
    rows.push([
      `${percent !== null ? `${100 - percent}% ` : ''}${laterTimingText(locale, plan.balanceDue)}`,
      formatMoney(balance, locale),
    ])
  }
  return section(heading, kvTable(rows))
}

/**
 * Totals block of a Booking Confirmation & Payment Request. "Received" is shown
 * only when the ledger holds money, and is worded as the ledger figure — never
 * as a payment status. `preRows` carries document-specific rows above the total
 * (subtotal, discount, adjustments).
 */
export function paymentRequestSummary(locale: DocLocale, due: PaymentDue, preRows: SummaryRow[] = []): string {
  const rows: SummaryRow[] = [...preRows]
  rows.push({
    label: t(locale, 'Agreed total', 'الإجمالي المتفق عليه'),
    value: formatMoney(due.total, locale),
    tone: 'total',
  })
  if (due.amountPaid > 0) {
    rows.push({
      label: t(locale, 'Received to date (per our records)', 'المستلم حتى الآن (حسب سجلاتنا)'),
      value: formatMoney(due.amountPaid, locale),
      tone: 'muted',
    })
  }
  if (due.dueNow === null) {
    rows.push({
      label: t(
        locale,
        'Remaining balance (payment schedule agreed with our team)',
        'المتبقي (جدول الدفع متفق عليه مع فريقنا)',
      ),
      value: formatMoney(due.remaining, locale),
      tone: 'due',
    })
  } else {
    rows.push({
      label: t(locale, 'Amount currently required', 'المبلغ المطلوب حالياً'),
      value: formatMoney(due.dueNow, locale),
      tone: 'due',
    })
    if (due.dueLater !== null && due.dueLater > 0) {
      const timing = due.laterTiming ? ` — ${laterTimingText(locale, due.laterTiming)}` : ''
      rows.push({
        label: `${t(locale, 'Balance due later', 'الرصيد المستحق لاحقاً')}${timing}`,
        value: formatMoney(due.dueLater, locale),
        tone: 'muted',
      })
    }
  }
  return summaryTable(rows)
}

/** How to pay, from the active payment_methods rows. Account details are not invented here. */
export function paymentMethodsSection(
  locale: DocLocale,
  methods: readonly PaymentMethod[],
  contact: DocumentContact,
  reference: string,
): string {
  const heading = t(locale, 'How to pay', 'طرق الدفع')
  const items = methods
    .filter((method) => method.is_active !== false)
    .map((method) => {
      const name = locale === 'ar' ? method.name_ar : method.name_en
      return method.on_request_only ? `${name} (${t(locale, 'on request', 'عند الطلب')})` : name
    })
  const instruction = t(
    locale,
    `To pay, please contact us on WhatsApp (${contact.whatsapp}) and quote reference ${reference}. A payment counts once our team has received and recorded it.`,
    `للدفع، يرجى التواصل معنا عبر واتساب (${contact.whatsapp}) مع ذكر المرجع ${reference}. يُحتسب الدفع بعد أن يستلمه فريقنا ويسجّله.`,
  )
  return section(heading, (items.length ? bulletList(items) : '') + paragraphs(instruction))
}

/** Terms & conditions from site_settings, exactly the text the old invoice used. */
export function termsSection(locale: DocLocale, settings: SiteSettings | null | undefined): string {
  const text = locale === 'ar'
    ? (settings?.terms_ar || 'شروط وأحكام الاستخدام')
    : (settings?.terms_en || 'Terms and Conditions')
  return section(t(locale, 'Terms & conditions', 'الشروط والأحكام'), `<div class="terms">${paragraphs(text)}</div>`)
}

export function noteSection(locale: DocLocale, notes: string | null | undefined): string {
  if (!notes) return ''
  return section(t(locale, 'Additional notes', 'ملاحظات إضافية'), callout('info', null, notes))
}
