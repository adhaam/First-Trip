import { escapeHtml as esc } from '@/lib/safe-html'
import type { PriceSnapshot } from '@/lib/types'

/**
 * Versioned customer quotation for a Build-Your-Trip journey.
 *
 * This is deliberately NOT an invoice and never calls itself one: until the
 * suppliers have confirmed availability it is a provisional price offer. The
 * only place the word "invoice" appears is the disclaimer saying so, so no
 * reader can mistake it for a tax document.
 *
 * Pure (no server imports) so it can be unit-tested; callers supply every fact.
 */

export type QuotationLocale = 'ar' | 'en'

export type QuotationLine = {
  key: string
  label_en: string
  label_ar: string
  amount: number
}

export type QuotationName = { name_ar: string; name_en: string }

export const QUOTATION_DISCLAIMER_EN = 'Not a confirmation or a tax invoice.'
export const QUOTATION_DISCLAIMER_AR = 'ليس تأكيدًا للحجز ولا فاتورة ضريبية.'
export const QUOTATION_FOOTER_DISCLAIMER_EN = 'This quotation is not a tax invoice.'
export const QUOTATION_FOOTER_DISCLAIMER_AR = 'عرض السعر هذا ليس فاتورة ضريبية.'

const CONFIRMED_STATUSES = ['awaiting_payment', 'confirmed', 'completed']

function cents(value: number): number {
  return Math.round((value + Number.EPSILON) * 100)
}

function amountOf(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/**
 * Itemised lines from a frozen price snapshot. The lines always sum to
 * snapshot.total: a gap (an admin price override, a component this function
 * does not know about) becomes an explicit "Other / adjustment" line rather
 * than a silent difference.
 */
export function quotationLines(
  snapshot: PriceSnapshot | null | undefined,
  names: { trips?: Record<string, QuotationName>; packages?: Record<string, QuotationName> } = {},
): QuotationLine[] {
  if (!snapshot) return []
  const lines: QuotationLine[] = []
  const push = (line: QuotationLine) => {
    if (cents(line.amount) !== 0) lines.push(line)
  }

  push({
    key: 'accommodation', label_en: 'Accommodation', label_ar: 'الإقامة',
    amount: amountOf(snapshot.accommodation_subtotal),
  })
  push({
    key: 'included_trips',
    label_en: 'Trips included with the stay',
    label_ar: 'رحلات مشمولة مع الإقامة',
    amount: amountOf(snapshot.included_trips_subtotal),
  })
  push({
    key: 'transfer', label_en: 'Transport', label_ar: 'الانتقالات',
    amount: amountOf(snapshot.transfer_subtotal),
  })
  push({ key: 'meals', label_en: 'Meals', label_ar: 'الوجبات', amount: amountOf(snapshot.meal_subtotal) })

  const people = amountOf(snapshot.num_people)
  const trips = snapshot.extra_trips ?? []
  if (trips.length && people > 0) {
    for (const trip of trips) {
      const known = names.trips?.[trip.trip_id]
      push({
        key: `trip:${trip.trip_id}`,
        label_en: known?.name_en || trip.name_en,
        label_ar: known?.name_ar || trip.name_en,
        amount: amountOf(trip.price) * people,
      })
    }
  } else {
    push({
      key: 'extra_trips', label_en: 'Experiences', label_ar: 'التجارب',
      amount: amountOf(snapshot.extra_trips_subtotal),
    })
  }

  for (const pkg of snapshot.trip_packages ?? []) {
    const known = names.packages?.[pkg.package_id]
    push({
      key: `package:${pkg.package_id}`,
      label_en: known?.name_en || pkg.name_en,
      label_ar: known?.name_ar || pkg.name_en,
      amount: amountOf(pkg.total),
    })
  }

  const gap = cents(amountOf(snapshot.total)) - lines.reduce((sum, line) => sum + cents(line.amount), 0)
  if (gap !== 0) {
    lines.push({
      key: 'adjustment', label_en: 'Other / adjustment', label_ar: 'أخرى / تسوية', amount: gap / 100,
    })
  }
  return lines
}

// ─── HTML ───

export type QuotationJourney = {
  arrival_date: string
  departure_date: string
  nights: number | null
  adults: number
  children: number
  transport_mode: 'package_bus' | 'hiace' | 'stay_only' | string
  origin?: QuotationName | null
  stay?: QuotationName | null
  rooms: { type: 'single' | 'double' | 'triple' | string; count: number }[]
  meal_plan?: QuotationName | null
  experiences: QuotationName[]
}

export type QuotationPaymentPlan = {
  rule?: string | null
  upfrontPercent?: number | null
  upfrontAmount?: number | null
  balanceAmount?: number | null
  balanceDue?: string | null
}

export type QuotationInput = {
  reference: string
  revision_number: number
  is_current: boolean
  /** Revision number that replaced this one (only meaningful when !is_current). */
  superseded_by?: number | null
  /** The request's status. */
  status: string
  availability_confirmed: boolean
  created_at: string
  customer_name: string
  journey: QuotationJourney
  lines: QuotationLine[]
  total: number
  previous_total?: number | null
  difference?: number | null
  payment_plan?: QuotationPaymentPlan | null
  locale: QuotationLocale
}

const TRANSPORT_LABELS: Record<string, QuotationName> = {
  package_bus: { name_en: 'Shared bus', name_ar: 'باص جماعي' },
  hiace: { name_en: 'Private Hiace', name_ar: 'هايس خاص' },
  stay_only: { name_en: 'Stay only (no transport)', name_ar: 'إقامة فقط (بدون انتقالات)' },
}

const ROOM_LABELS: Record<string, QuotationName> = {
  single: { name_en: 'Single room', name_ar: 'غرفة مفردة' },
  double: { name_en: 'Double room', name_ar: 'غرفة مزدوجة' },
  triple: { name_en: 'Triple room', name_ar: 'غرفة ثلاثية' },
}

/** Supplier availability counts as confirmed only for these request statuses. */
export function isQuotationConfirmed(status: string, availabilityConfirmed: boolean): boolean {
  return availabilityConfirmed && CONFIRMED_STATUSES.includes(status)
}

function money(value: number, ar: boolean): string {
  const n = Number.isFinite(value) ? value : 0
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${ar ? 'ج.م' : 'EGP'}`
}

function signedMoney(value: number, ar: boolean): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${money(Math.abs(value), ar)}`
}

function day(value: string): string {
  return value.slice(0, 10)
}

/** A timestamp's calendar day in Dahab (Africa/Cairo), not UTC: 01:30 Cairo is still "today" there. */
export function cairoDay(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return day(value)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(date)
}

type Fact = [string, string, string]

function travellersText(j: QuotationJourney, ar: boolean): string {
  if (ar) return `${j.adults} بالغ${j.children ? ` و${j.children} طفل` : ''}`
  const adults = `${j.adults} adult${j.adults === 1 ? '' : 's'}`
  if (!j.children) return adults
  return `${adults}, ${j.children} child${j.children === 1 ? '' : 'ren'}`
}

const STYLES = (ar: boolean) => `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1a1a1a;
      line-height: 1.6; background: #f5f5f5; padding: 20px; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; padding: 36px; border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,.1); }
    header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;
      border-bottom: 2px solid #f0a000; padding-bottom: 16px; margin-bottom: 20px; }
    header h1 { font-size: 26px; color: #f0a000; }
    header .meta { text-align: ${ar ? 'left' : 'right'}; font-size: 14px; color: #555; }
    .banner { padding: 12px 16px; border-radius: 8px; font-weight: 700; margin-bottom: 12px; font-size: 15px; }
    .banner.provisional { background: #fff4d6; border: 2px solid #f0a000; color: #6b4600; }
    .banner.superseded { background: #fde8e8; border: 2px solid #c62828; color: #7f1d1d; }
    h2 { font-size: 16px; margin: 22px 0 8px; color: #333; }
    table { width: 100%; border-collapse: collapse; }
    table.kv th { text-align: ${ar ? 'right' : 'left'}; width: 38%; font-weight: 600; color: #555; padding: 6px 0;
      vertical-align: top; }
    table.kv td { padding: 6px 0; }
    table.lines td { padding: 8px 6px; border-bottom: 1px solid #eee; text-align: ${ar ? 'right' : 'left'}; }
    td.num, table.lines td.num { text-align: ${ar ? 'left' : 'right'}; white-space: nowrap;
      font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 800; font-size: 17px; border-top: 2px solid #1a1a1a; border-bottom: 0; }
    tr.muted td { color: #666; }
    .foot { margin-top: 24px; font-size: 12px; color: #777; }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border-radius: 0; padding: 0; max-width: none; }
      .banner { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `

export function generateQuotationHTML(input: QuotationInput): string {
  const ar = input.locale === 'ar'
  const t = (en: string, arText: string) => esc(ar ? arText : en)
  const name = (value: QuotationName) => esc(ar ? value.name_ar || value.name_en : value.name_en || value.name_ar)
  const provisional = !isQuotationConfirmed(input.status, input.availability_confirmed)
  const title = ar ? 'عرض سعر' : 'Quotation'
  const revisionLabel = ar ? `المراجعة رقم ${input.revision_number}` : `Revision ${input.revision_number}`
  const j = input.journey

  const banners: string[] = []
  if (!input.is_current) {
    const by = input.superseded_by
    const text = ar
      ? (by ? `تم استبداله بالمراجعة رقم ${by}` : 'تم استبداله بمراجعة أحدث')
      : (by ? `SUPERSEDED by revision ${by}` : 'SUPERSEDED by a later revision')
    banners.push(`<div class="banner superseded" role="alert">${esc(text)}</div>`)
  }
  if (provisional) {
    const text = ar
      ? `مبدئي — رهن تأكيد التوفر من المورد. ${QUOTATION_DISCLAIMER_AR}`
      : `PROVISIONAL — subject to supplier availability. ${QUOTATION_DISCLAIMER_EN}`
    banners.push(`<div class="banner provisional" role="alert">${esc(text)}</div>`)
  }

  const transport = TRANSPORT_LABELS[j.transport_mode]
  const roomText = (room: QuotationJourney['rooms'][number]) =>
    `${esc(room.count)} × ${ROOM_LABELS[room.type] ? name(ROOM_LABELS[room.type]) : esc(room.type)}`
  const facts: Fact[] = [
    ['Dates', 'التواريخ', `${esc(day(j.arrival_date))} → ${esc(day(j.departure_date))}`],
  ]
  if (j.nights !== null) facts.push(['Nights', 'عدد الليالي', esc(j.nights)])
  facts.push(['Travellers', 'المسافرون', esc(travellersText(j, ar))])
  facts.push(['Transport', 'الانتقالات', transport ? name(transport) : esc(j.transport_mode)])
  if (j.origin) facts.push(['Travelling from', 'الانطلاق من', name(j.origin)])
  if (j.stay) facts.push(['Stay', 'مكان الإقامة', name(j.stay)])
  if (j.rooms.length) facts.push(['Rooms', 'الغرف', j.rooms.map(roomText).join('<br>')])
  if (j.meal_plan) facts.push(['Meal plan', 'نظام الوجبات', name(j.meal_plan)])
  if (j.experiences.length) facts.push(['Experiences', 'التجارب', j.experiences.map(name).join('<br>')])
  const factRows = facts
    .map(([en, arLabel, value]) => `<tr><th>${t(en, arLabel)}</th><td>${value}</td></tr>`)
    .join('')

  const lineRows = input.lines
    .map((line) => {
      const label = esc(ar ? line.label_ar : line.label_en)
      return `<tr><td>${label}</td><td class="num">${esc(money(line.amount, ar))}</td></tr>`
    })
    .join('')

  let previousRows = ''
  if (input.previous_total !== null && input.previous_total !== undefined) {
    const previous = Number(input.previous_total)
    const difference = Number(input.difference ?? input.total - previous)
    previousRows = `<tr class="muted"><td>${t('Previous total', 'الإجمالي السابق')}</td>`
      + `<td class="num">${esc(money(previous, ar))}</td></tr>`
      + `<tr class="muted"><td>${t('Difference', 'الفرق')}</td>`
      + `<td class="num">${esc(signedMoney(difference, ar))}</td></tr>`
  }

  const plan = input.payment_plan
  let payment = ''
  if (plan && plan.upfrontAmount !== null && plan.upfrontAmount !== undefined) {
    const percent = plan.upfrontPercent ?? null
    const balance = plan.balanceAmount ?? 0
    const upfrontLabel = `${percent !== null ? `${esc(percent)}% ` : ''}${t('after confirmation', 'بعد التأكيد')}`
    const balanceWhen = plan.balanceDue === 'before_service'
      ? t('before the service', 'قبل الخدمة')
      : t('on arrival', 'عند الوصول')
    const balanceLabel = `${percent !== null ? `${esc(100 - percent)}% ` : ''}${balanceWhen}`
    payment = `<h2>${t('Payment terms', 'شروط الدفع')}</h2><table class="kv">`
      + `<tr><th>${upfrontLabel}</th><td class="num">${esc(money(plan.upfrontAmount, ar))}</td></tr>`
      + (balance > 0 ? `<tr><th>${balanceLabel}</th><td class="num">${esc(money(balance, ar))}</td></tr>` : '')
      + '</table>'
  } else if (plan) {
    const agreed = t(
      'Payment terms are agreed with the team for this quotation.',
      'يتم الاتفاق على شروط الدفع مع الفريق لهذا العرض.',
    )
    payment = `<h2>${t('Payment terms', 'شروط الدفع')}</h2><p>${agreed}</p>`
  }

  const footerText = ar ? QUOTATION_FOOTER_DISCLAIMER_AR : QUOTATION_FOOTER_DISCLAIMER_EN
  const footer = provisional ? '' : `<p class="foot">${esc(footerText)}</p>`

  return `<!DOCTYPE html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} ${esc(input.reference)} - ${esc(revisionLabel)}</title>
  <style>${STYLES(ar)}</style>
</head>
<body>
  <div class="page">
    <header>
      <div><h1>${esc(title)}</h1><div>${esc(revisionLabel)}</div></div>
      <div class="meta"><div>${t('Reference', 'المرجع')}: <strong>${esc(input.reference)}</strong></div>
        <div>${t('Issued', 'تاريخ الإصدار')}: ${esc(cairoDay(input.created_at))}</div></div>
    </header>
    ${banners.join('\n    ')}
    <h2>${t('Prepared for', 'أُعد لـ')}</h2>
    <p>${esc(input.customer_name)}</p>
    <h2>${t('Your journey', 'رحلتك')}</h2>
    <table class="kv">${factRows}</table>
    <h2>${t('Price breakdown', 'تفاصيل السعر')}</h2>
    <table class="lines">
      ${lineRows}
      <tr class="total"><td>${t('Total', 'الإجمالي')}</td><td class="num">${esc(money(input.total, ar))}</td></tr>
      ${previousRows}
    </table>
    ${payment}
    ${footer}
  </div>
</body>
</html>`
}
