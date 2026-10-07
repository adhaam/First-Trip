/**
 * M2 Trip Builder UI — pure view-model helpers for the flagship `/plan`
 * rebuild. Kept separate from `view.ts` (owned by a different pass) so this
 * batch's additions are easy to review in isolation.
 *
 * Every function here decides WHICH translated line a collapsed journey
 * section should show and WHAT data to interpolate into it — never the
 * English/Arabic text itself (that lives in `src/messages/{ar,en}/builder.json`
 * under the matching `summary*` key). This keeps the decision (“this section
 * is done, here’s the one-line recap”) unit-testable without a React tree or
 * an i18n provider.
 */
import { formatDate } from '@/lib/format'
import { HIACE_RECOMMENDED_DEPARTURE_WEEKDAYS } from '@/lib/transport'
import type { TransportScheduleConfig } from '@/lib/transport'
import type { TransportMode } from '@/lib/trip-requests/schema'
import { patternsForMode, returnDateFor, stayNights } from './dates'
import { roomCapacity } from './rooms'
import type { BuilderCatalog, BuilderState } from './types'

export type SectionSummary = { key: string; values?: Record<string, string | number> } | null

type Named = { name_ar: string; name_en: string }

function localizedName(locale: 'ar' | 'en', item?: Named): string {
  if (!item) return ''
  return locale === 'ar' ? item.name_ar : item.name_en
}

/**
 * Section 1 — transport mode + origin, once a mode (and origin, if required)
 * is chosen. Deliberately does NOT interpolate `transferServices[].name_ar` /
 * `name_en` — those are raw DB labels (e.g. "Package Transfer") the brief
 * explicitly rules out in favour of designed copy ("WEEMAP Bus"). The
 * designed name is baked into the `summaryTransport*` message itself, one
 * key per mode, the same way `TransportStep`'s `TRANSPORT_COPY` does it.
 */
export function transportSummary(state: BuilderState, catalog: BuilderCatalog, locale: 'ar' | 'en'): SectionSummary {
  if (!state.transport_mode) return null
  if (state.transport_mode === 'stay_only') return { key: 'summaryStayOnly' }

  const origin = catalog.governorates.find((item) => item.code === state.origin_governorate_code)
  if (!origin) return null

  return {
    key: state.transport_mode === 'hiace' ? 'summaryTransportHiace' : 'summaryTransportPackageBus',
    values: { origin: localizedName(locale, origin) },
  }
}

/** Section 2 — resolved dates, for both the transport flow and stay-only. */
export function datesSummary(state: BuilderState, catalog: BuilderCatalog, locale: 'ar' | 'en'): SectionSummary {
  if (state.transport_mode === 'stay_only') {
    if (!state.arrival_date || !state.departure_date) return null
    const nights = stayNights(state.arrival_date, state.departure_date) ?? 0
    return { key: 'summaryStayDates', values: { arrival: formatDate(state.arrival_date, locale), departure: formatDate(state.departure_date, locale), nights } }
  }

  if (!state.transport_mode || !state.stay_pattern_code || !state.arrival_date) return null
  const pattern = patternsForMode(catalog.schedule, state.transport_mode).find((item) => item.code === state.stay_pattern_code)
  const returnDate = returnDateFor(catalog.schedule, {
    mode: state.transport_mode,
    patternCode: state.stay_pattern_code,
    originCode: state.origin_governorate_code,
    arrivalDate: state.arrival_date,
  })
  if (!pattern || !returnDate) return null

  return {
    key: 'summaryTransportDates',
    values: {
      pattern: localizedName(locale, { name_ar: pattern.nameAr, name_en: pattern.nameEn }),
      arrival: formatDate(state.arrival_date, locale),
      return: formatDate(returnDate, locale),
    },
  }
}

/** Section 3 — travellers is always "complete" (defaults to 1 adult), so this always has a value. */
export function travelersSummary(state: BuilderState): SectionSummary {
  const adults = Math.max(1, state.adults ?? 1)
  const children = Math.max(0, state.children ?? 0)
  return { key: children > 0 ? 'summaryTravelersWithChildren' : 'summaryTravelers', values: { adults, children } }
}

/** Section 4 — chosen stay, or the explicit "transfer only" choice. */
export function staySummary(state: BuilderState, catalog: BuilderCatalog, locale: 'ar' | 'en'): SectionSummary {
  if (!state.accommodation_id) {
    // A transport mode must be chosen before "transfer only" is a meaningful recap.
    return state.transport_mode && state.transport_mode !== 'stay_only' ? { key: 'summaryTransferOnly' } : null
  }
  const stay = catalog.accommodations.find((item) => item.id === state.accommodation_id)
  if (!stay) return null
  return { key: 'summaryStay', values: { stay: localizedName(locale, stay) } }
}

/** Section 5 — room allocation + meal plan, once rooms have been assigned. */
export function roomsSummary(state: BuilderState, catalog: BuilderCatalog, locale: 'ar' | 'en'): SectionSummary {
  if (!state.accommodation_id) return null
  const allocations = state.room_allocations ?? []
  if (!allocations.length) return null

  const stay = catalog.accommodations.find((item) => item.id === state.accommodation_id)
  const meal = stay?.meal_plans.find((item) => item.key === state.meal_plan_key)
  const capacity = roomCapacity(allocations)

  if (meal) {
    return {
      key: 'summaryRoomsMeal',
      values: { rooms: allocations.length, capacity, meal: localizedName(locale, { name_ar: meal.label_ar, name_en: meal.label_en }) },
    }
  }
  return { key: 'summaryRooms', values: { rooms: allocations.length, capacity } }
}

/** Section 6 — count of trips/packages added; optional, so `null` just means "nothing added yet". */
export function experiencesSummary(state: BuilderState): SectionSummary {
  const count = state.experiences?.length ?? 0
  return count > 0 ? { key: 'summaryExperiences', values: { count } } : null
}

/**
 * Weekday names WEEMAP recommends checking in on, for a stay-only booking —
 * a soft hint (never a restriction) derived from
 * `TransportScheduleConfig.recommendedCheckInWeekdays`, never hard-coded.
 * Returns an empty string when nothing is configured, so the caller can
 * simply skip rendering the hint.
 */
export function hiaceRecommendedDepartureNames(locale: 'ar' | 'en'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' })
  const names = [...HIACE_RECOMMENDED_DEPARTURE_WEEKDAYS]
    .sort((a, b) => a - b)
    .map((day) => formatter.format(new Date(Date.UTC(2026, 8, 20 + day))))
  return names.join(locale === 'ar' ? '، ' : ' & ')
}

export function recommendedCheckInWeekdayNames(schedule: TransportScheduleConfig, locale: 'ar' | 'en'): string {
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' })
  // 2026-09-20 is a Sunday (weekday 0); Date.UTC(...,20 + weekday) walks the
  // rest of that week — same technique `weekdayHint` in view.ts already uses.
  const names = [...new Set(schedule.recommendedCheckInWeekdays)]
    .sort((a, b) => a - b)
    .map((day) => formatter.format(new Date(Date.UTC(2026, 8, 20 + day))))
  return names.join(locale === 'ar' ? '، ' : ' & ')
}

/**
 * Weekday names a scheduled transfer type departs on, read from
 * `weeklyRules` — never hard-coded. Hiace (and any other on-demand service)
 * has no weekly rule and is arranged privately, so this returns an empty
 * string for it; the caller shows a fixed "any day" phrase in that case.
 */
export function transportOutboundWeekdayNames(schedule: TransportScheduleConfig, mode: TransportMode | undefined, locale: 'ar' | 'en'): string {
  if (!mode || mode === 'stay_only') return ''
  const formatter = new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', { weekday: 'long' })
  const days = schedule.weeklyRules.filter((rule) => rule.isActive && rule.transferType === mode && rule.direction === 'outbound').map((rule) => rule.weekday)
  const names = [...new Set(days)].sort((a, b) => a - b).map((day) => formatter.format(new Date(Date.UTC(2026, 8, 20 + day))))
  return names.join(locale === 'ar' ? '، ' : ' & ')
}
