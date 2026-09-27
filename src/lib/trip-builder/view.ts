import type { PaymentPlan } from '@/lib/payment-rules'
import type { BuilderCatalog, BuilderState } from './types'

export type QuoteView = {
  total: number
  lines: { key: string; label_ar: string; label_en: string; detail_ar?: string; detail_en?: string; amount: number }[]
  payment: PaymentPlan
}

export function weekdayHint(catalog: BuilderCatalog, mode?: string, locale: 'ar' | 'en' = 'en') {
  if (mode === 'hiace') return locale === 'ar' ? 'متاح في أي يوم حسب التأكيد' : 'Any day, privately arranged'
  const days = catalog.schedule.weeklyRules
    .filter((rule) => rule.isActive && rule.transferType === mode && rule.direction === 'outbound')
    .map((rule) => rule.weekday)
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' })
  const names = [...new Set(days)].sort((a, b) => a - b).map((day) => formatter.format(new Date(Date.UTC(2026, 8, 20 + day))))
  return names.join(locale === 'ar' ? '، ' : ', ')
}

export function paymentRows(quote: QuoteView | null) {
  if (!quote) return []
  const afterConfirmation = quote.payment.upfrontAmount
  const onArrival = quote.payment.balanceAmount
  return [
    ...(afterConfirmation != null ? [{ key: 'after_confirmation', amount: afterConfirmation }] : []),
    ...(onArrival != null && onArrival > 0 ? [{ key: 'on_arrival', amount: onArrival }] : []),
  ]
}

export function summaryFor(state: BuilderState, catalog: BuilderCatalog, locale: 'ar' | 'en') {
  const name = (item?: { name_ar: string; name_en: string }) => item ? (locale === 'ar' ? item.name_ar : item.name_en) : ''
  return {
    stay: name(catalog.accommodations.find((item) => item.id === state.accommodation_id)),
    experiences: (state.experiences ?? []).map((selection) => name(selection.kind === 'trip'
      ? catalog.trips.find((item) => item.id === selection.id)
      : catalog.packages.find((item) => item.id === selection.id))).filter(Boolean),
  }
}

export function quoteErrorKey(code?: string) {
  if (code === '429') return 'quoteRateLimited'
  if (code?.startsWith('SCHEDULE_')) return 'quoteScheduleError'
  return 'quoteError'
}
