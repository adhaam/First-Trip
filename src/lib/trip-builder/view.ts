import type { PaymentPlan } from '@/lib/payment-rules'
import type { BuilderCatalog, BuilderState } from './types'

export type RoomPlanAllocation = { type: 'single' | 'double' | 'triple'; count: number }

/** Server-authoritative room plan returned with a room-priced quote. */
export type RoomPlanView = {
  mode: 'recommended' | 'custom'
  people: number
  allocations: RoomPlanAllocation[]
  accommodation_total: number
  recommended: { allocations: RoomPlanAllocation[]; accommodation_total: number } | null
  difference: number
  room_types: {
    type: RoomPlanAllocation['type']
    capacity: number
    available: boolean
    stay_total_per_room: number | null
  }[]
}

export type QuoteView = {
  total: number
  lines: { key: string; label_ar: string; label_en: string; detail_ar?: string; detail_en?: string; amount: number }[]
  payment: PaymentPlan
  rooms?: RoomPlanView
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
  if (code === 'ROOMS_MANUAL_CONFIRMATION') return 'quoteRoomsManual'
  if (code === 'ROOM_TYPE_UNAVAILABLE') return 'quoteRoomTypeUnavailable'
  if (code === 'ROOM_CAPACITY_EXCEEDED') return 'quoteRoomsCapacity'
  if (code === 'ROOMS_EXCEED_GUESTS') return 'quoteRoomsTooMany'
  return 'quoteError'
}

/**
 * The room allocation the server recommends for the current party — what auto
 * mode shows in the steppers and recaps. `undefined` until a quote exists, and
 * ignored when it was priced for a different party size (a stale quote).
 */
export function recommendedAllocations(quote: QuoteView | null, people: number): RoomPlanAllocation[] | undefined {
  const rooms = quote?.rooms
  if (!rooms || rooms.people !== people) return undefined
  const recommended = rooms.recommended?.allocations ?? (rooms.mode === 'recommended' ? rooms.allocations : undefined)
  return recommended?.length ? recommended : undefined
}
