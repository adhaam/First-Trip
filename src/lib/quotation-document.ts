import { escapeHtml as esc } from '@/lib/safe-html'
import type { PriceSnapshot, SiteSettings } from '@/lib/types'
import {
  amountOf, cairoDate, calendarDay, cents, DOCUMENT_TITLES, formatMoney, pick, type DocLocale,
} from '@/lib/documents/format'
import { paymentTermsSection, termsSection, type PlanTerms } from '@/lib/documents/sections'
import {
  chargesTable, kvTable, renderDocument, resolveContact, section, summaryTable,
  type Cell, type DocBanner, type SummaryRow,
} from '@/lib/documents/template'

/**
 * Versioned customer quotation for a Build-Your-Trip journey, rendered on the
 * shared branded template (lib/documents).
 *
 * Until the suppliers have confirmed availability this is a "Provisional
 * Quotation" and says so in a banner. It is never a confirmation and never an
 * invoice: the only place the word "invoice" appears is the footer line saying
 * the document is not a tax invoice.
 *
 * Pure (no server imports) so it can be unit-tested; callers supply every fact.
 */

export type QuotationLocale = DocLocale

export type QuotationLine = {
  key: string
  label_en: string
  label_ar: string
  amount: number
}

export type QuotationName = { name_ar: string; name_en: string }

export const QUOTATION_DISCLAIMER_EN = 'Not a confirmation or a tax invoice.'
export const QUOTATION_DISCLAIMER_AR = 'ليس تأكيدًا للحجز ولا فاتورة ضريبية.'

const CONFIRMED_STATUSES = ['awaiting_payment', 'confirmed', 'completed']

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

export type QuotationPaymentPlan = PlanTerms

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
  /** Site settings for the contact footer and the terms block; absent → the site's default contact details. */
  settings?: SiteSettings | null
  locale: QuotationLocale
}

const TRANSPORT_LABELS: Record<string, QuotationName> = {
  package_bus: { name_en: 'Shared bus', name_ar: 'باص جماعي' },
  hiace: { name_en: 'Private Hiace', name_ar: 'هايس خاص' },
  stay_only: { name_en: 'Self-arrival (no WEEMAP transport)', name_ar: 'وصول ذاتي (بدون انتقالات WEEMAP)' },
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

function signedMoney(value: number, locale: DocLocale): string {
  return `${value > 0 ? '+' : value < 0 ? '-' : ''}${formatMoney(Math.abs(value), locale)}`
}

/** A timestamp's calendar day in Dahab (Africa/Cairo), not UTC: 01:30 Cairo is still "today" there. */
export function cairoDay(value: string): string {
  return cairoDate(value)
}

function travellersText(j: QuotationJourney, ar: boolean): string {
  if (ar) return `${j.adults} بالغ${j.children ? ` و${j.children} طفل` : ''}`
  const adults = `${j.adults} adult${j.adults === 1 ? '' : 's'}`
  if (!j.children) return adults
  return `${adults}, ${j.children} child${j.children === 1 ? '' : 'ren'}`
}

/** Escaped text with line breaks kept (rooms and experiences list one per line). */
function lines(values: string[]): Cell {
  return { html: values.map((value) => esc(value)).join('<br>') }
}

/** The "Your journey" facts shared by the quotation and the journey confirmation. */
export function journeyFactsSection(j: QuotationJourney, locale: DocLocale): string {
  const ar = locale === 'ar'
  const label = (value: QuotationName) => (ar ? value.name_ar || value.name_en : value.name_en || value.name_ar)
  const rows: Array<[string, Cell]> = [
    [ar ? 'التواريخ' : 'Dates', `${calendarDay(j.arrival_date)} → ${calendarDay(j.departure_date)}`],
  ]
  if (j.nights !== null) rows.push([ar ? 'عدد الليالي' : 'Nights', j.nights])
  rows.push([ar ? 'المسافرون' : 'Travellers', travellersText(j, ar)])
  const transport = TRANSPORT_LABELS[j.transport_mode]
  rows.push([ar ? 'الانتقالات' : 'Transport', transport ? label(transport) : j.transport_mode])
  if (j.origin) rows.push([ar ? 'الانطلاق من' : 'Travelling from', label(j.origin)])
  if (j.stay) rows.push([ar ? 'مكان الإقامة' : 'Stay', label(j.stay)])
  if (j.rooms.length) {
    rows.push([ar ? 'الغرف' : 'Rooms', lines(j.rooms.map((room) => {
      const known = ROOM_LABELS[room.type]
      return `${room.count} × ${known ? label(known) : room.type}`
    }))])
  }
  if (j.meal_plan) rows.push([ar ? 'نظام الوجبات' : 'Meal plan', label(j.meal_plan)])
  if (j.experiences.length) rows.push([ar ? 'التجارب' : 'Experiences', lines(j.experiences.map(label))])
  return section(ar ? 'رحلتك' : 'Your journey', kvTable(rows))
}

/** The itemised price breakdown (no quantity columns: journey lines are priced lump-sum). */
export function journeyLinesSection(items: QuotationLine[], locale: DocLocale): string {
  const ar = locale === 'ar'
  return section(
    ar ? 'تفاصيل السعر' : 'Price breakdown',
    chargesTable(
      { description: ar ? 'البند' : 'Item', quantity: '', unit: '', total: ar ? 'المبلغ' : 'Amount' },
      items.map((line) => ({
        description: ar ? line.label_ar : line.label_en,
        total: formatMoney(line.amount, locale),
      })),
      false,
    ),
  )
}

/** Stable per revision: the same revision always prints the same number. */
export function quotationNumber(reference: string, revision: number): string {
  return `${reference}-Q${revision}`
}

export function generateQuotationHTML(input: QuotationInput): string {
  const locale = input.locale
  const ar = locale === 'ar'
  const t = (en: string, arText: string) => (ar ? arText : en)
  const provisional = !isQuotationConfirmed(input.status, input.availability_confirmed)
  const title = provisional
    ? pick(DOCUMENT_TITLES.provisional_quotation, locale)
    : t('Quotation', 'عرض سعر')

  const banners: DocBanner[] = []
  if (!input.is_current) {
    const by = input.superseded_by
    banners.push({
      tone: 'superseded',
      text: ar
        ? (by ? `تم استبداله بالمراجعة رقم ${by}` : 'تم استبداله بمراجعة أحدث')
        : (by ? `SUPERSEDED by revision ${by}` : 'SUPERSEDED by a later revision'),
    })
  }
  if (provisional) {
    banners.push({
      tone: 'provisional',
      text: ar
        ? `مبدئي — رهن تأكيد التوفر من المورد. ${QUOTATION_DISCLAIMER_AR}`
        : `PROVISIONAL — subject to supplier availability. ${QUOTATION_DISCLAIMER_EN}`,
    })
  }

  const summaryRows: SummaryRow[] = [
    { label: t('Total', 'الإجمالي'), value: formatMoney(input.total, locale), tone: 'total' },
  ]
  if (input.previous_total !== null && input.previous_total !== undefined) {
    const previous = Number(input.previous_total)
    const difference = Number(input.difference ?? input.total - previous)
    summaryRows.push(
      { label: t('Previous total', 'الإجمالي السابق'), value: formatMoney(previous, locale), tone: 'muted' },
      { label: t('Difference', 'الفرق'), value: signedMoney(difference, locale), tone: 'muted' },
    )
  }

  const body = [
    section(t('Prepared for', 'أُعد لـ'), kvTable([[t('Name', 'الاسم'), input.customer_name]])),
    journeyFactsSection(input.journey, locale),
    journeyLinesSection(input.lines, locale),
    summaryTable(summaryRows),
    paymentTermsSection(locale, input.payment_plan),
    termsSection(locale, input.settings),
  ].join('\n')

  return renderDocument({
    locale,
    kind: 'provisional_quotation',
    title,
    documentNumber: quotationNumber(input.reference, input.revision_number),
    issueDate: cairoDate(input.created_at),
    issueDateLabel: t('Issued', 'تاريخ الإصدار'),
    meta: [[t('Reference', 'المرجع'), input.reference], [t('Revision', 'المراجعة'), String(input.revision_number)]],
    banners,
    body,
    contact: resolveContact(input.settings, locale),
  })
}
