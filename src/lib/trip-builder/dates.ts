import { addDays, isRecommendedCheckIn, patternsFor, resolveStayPattern } from '@/lib/transport'
import type { TransportScheduleConfig } from '@/lib/transport'
import type { TransportMode } from '@/lib/trip-requests/schema'

export function patternsForMode(schedule: TransportScheduleConfig, mode: TransportMode | undefined) {
  return mode && mode !== 'stay_only' ? patternsFor(schedule, mode) : []
}

export function arrivalOptions(schedule: TransportScheduleConfig, input: { mode?: TransportMode; patternCode?: string; originCode?: string; from: string; count: number }): string[] {
  if (!input.mode || input.mode === 'stay_only' || !input.patternCode) return []

  const values: string[] = []
  for (let offset = 0; values.length < input.count && offset <= 190; offset += 1) {
    const date = addDays(input.from, offset)
    const result = resolveStayPattern(schedule, { patternCode: input.patternCode, transferType: input.mode, outboundDate: date, originCode: input.originCode })
    if (result.ok) values.push(date)
  }
  return values
}

export function returnDateFor(schedule: TransportScheduleConfig, input: { mode?: TransportMode; patternCode?: string; originCode?: string; arrivalDate?: string }): string | null {
  if (!input.mode || input.mode === 'stay_only' || !input.patternCode || !input.arrivalDate) return null
  const result = resolveStayPattern(schedule, { patternCode: input.patternCode, transferType: input.mode, outboundDate: input.arrivalDate, originCode: input.originCode })
  return result.ok ? result.returnDate : null
}

/** Stay-only dates are valid from tomorrow onward; transport dates must resolve a pattern. */
export function isValidArrival(schedule: TransportScheduleConfig, input: { mode?: TransportMode; patternCode?: string; originCode?: string; arrivalDate?: string; today?: string }) {
  if (input.mode === 'stay_only') {
    return Boolean(input.arrivalDate && input.today && input.arrivalDate >= earliestArrival(input.today))
  }
  // Custom hiace: any future date is a valid departure (no preset pattern).
  if (input.mode === 'hiace' && !input.patternCode) {
    return Boolean(input.arrivalDate && input.today && input.arrivalDate >= earliestArrival(input.today))
  }
  return returnDateFor(schedule, input) !== null
}

/** For a custom hiace booking: the return date must be strictly after the chosen departure. */
export function isValidCustomReturn(arrivalDate?: string, departureDate?: string): boolean {
  return Boolean(arrivalDate && departureDate && departureDate > arrivalDate)
}

export function stayNights(arrival?: string, departure?: string): number | null {
  if (!arrival || !departure) return null
  return Math.max(0, (Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86400000)
}

export function recommendedCheckIn(schedule: TransportScheduleConfig, date: string) {
  return isRecommendedCheckIn(schedule, date)
}

export function earliestArrival(today: string) {
  return addDays(today, 1)
}

/**
 * Nights of stay for the journey as the server prices it (see
 * resolveJourneyDates in src/lib/trip-requests/build.ts): a transport journey
 * takes the stay pattern's own `nights`, because the outbound bus travels
 * overnight and the calendar gap between departure and return is longer than
 * the stay; stay-only counts calendar nights between the chosen dates.
 */
export function journeyNights(
  schedule: TransportScheduleConfig,
  input: { mode?: TransportMode; patternCode?: string; originCode?: string; arrivalDate?: string; departureDate?: string },
): number | null {
  if (input.mode === 'stay_only') return stayNights(input.arrivalDate, input.departureDate)
  // Custom hiace: no preset pattern, nights are derived from the two dates
  // the customer chose (same as stay_only), mirroring resolveJourneyDates.
  if (input.mode === 'hiace' && !input.patternCode) return stayNights(input.arrivalDate, input.departureDate)
  if (!input.mode || !input.patternCode || !input.arrivalDate) return null
  const result = resolveStayPattern(schedule, {
    patternCode: input.patternCode,
    transferType: input.mode,
    outboundDate: input.arrivalDate,
    originCode: input.originCode,
  })
  return result.ok ? result.nights : null
}

/**
 * The calendar day a date picker's local Date represents, as YYYY-MM-DD.
 * Never use toISOString() for this: it converts to UTC, so midnight in Cairo
 * (UTC+2/+3) becomes the previous day.
 */
export function isoFromLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
