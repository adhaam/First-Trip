export type ScheduleMode = 'scheduled' | 'on_demand'
export type Direction = 'outbound' | 'return'

export type TransportService = {
  transferType: string
  isActive: boolean
  scheduleMode: ScheduleMode
}

export type WeeklyRule = {
  transferType: string
  direction: Direction
  weekday: number
  originGovernorateCode?: string | null
  validFrom?: string | null
  validTo?: string | null
  isActive: boolean
}

export type DateException = {
  transferType: string
  direction: Direction | 'both'
  serviceDate: string
  kind: 'blackout' | 'extra'
  originGovernorateCode?: string | null
  isActive: boolean
}

export type StayPattern = {
  code: string
  transferType?: string | null
  nameAr: string
  nameEn: string
  durationDays: number
  nights: number
  returnOffsetDays: number
  departureWeekdays?: number[] | null
  isActive: boolean
  sortOrder: number
}

export type TransportScheduleConfig = {
  services: TransportService[]
  weeklyRules: WeeklyRule[]
  exceptions: DateException[]
  stayPatterns: StayPattern[]
  recommendedCheckInWeekdays: number[]
}

export type ServiceDateResult =
  | { ok: true }
  | { ok: false; reason: 'unknown_service' | 'service_inactive' | 'not_operating_day' | 'blackout' }

export type StayPatternResult =
  | { ok: true; returnDate: string; nights: number; durationDays: number }
  | {
      ok: false
      reason:
        | 'unknown_pattern'
        | 'pattern_inactive'
        | 'pattern_transfer_type_mismatch'
        | 'invalid_departure_weekday'
        | 'outbound_not_operating'
        | 'return_not_operating'
    }

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function dateParts(date: string): [number, number, number] {
  if (!ISO_DATE.test(date)) throw new Error(`Expected ISO date (YYYY-MM-DD), received: ${date}`)
  const [year, month, day] = date.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error(`Expected valid ISO date (YYYY-MM-DD), received: ${date}`)
  }
  return [year, month, day]
}

export function weekdayForDate(date: string): number {
  const [year, month, day] = dateParts(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = dateParts(date)
  const result = new Date(Date.UTC(year, month - 1, day + days))
  return result.toISOString().slice(0, 10)
}

function matchesOrigin(originGovernorateCode: string | null | undefined, requestedOrigin: string | undefined): boolean {
  return originGovernorateCode == null || originGovernorateCode === requestedOrigin
}

function matchesException(exception: DateException, direction: Direction, date: string, originCode?: string): boolean {
  return (
    exception.isActive &&
    exception.serviceDate === date &&
    (exception.direction === direction || exception.direction === 'both') &&
    matchesOrigin(exception.originGovernorateCode, originCode)
  )
}

export function checkServiceDate(
  config: TransportScheduleConfig,
  input: { transferType: string; direction: Direction; date: string; originCode?: string },
): ServiceDateResult {
  dateParts(input.date)
  const service = config.services.find((candidate) => candidate.transferType === input.transferType)
  if (!service) return { ok: false, reason: 'unknown_service' }
  if (!service.isActive) return { ok: false, reason: 'service_inactive' }

  const relevantExceptions = config.exceptions.filter(
    (exception) => exception.transferType === input.transferType && matchesException(exception, input.direction, input.date, input.originCode),
  )
  if (relevantExceptions.some((exception) => exception.kind === 'blackout')) return { ok: false, reason: 'blackout' }
  if (service.scheduleMode === 'on_demand') return { ok: true }

  const weekday = weekdayForDate(input.date)
  const hasWeeklyRule = config.weeklyRules.some(
    (rule) =>
      rule.isActive &&
      rule.transferType === input.transferType &&
      rule.direction === input.direction &&
      rule.weekday === weekday &&
      matchesOrigin(rule.originGovernorateCode, input.originCode) &&
      (rule.validFrom == null || input.date >= rule.validFrom) &&
      (rule.validTo == null || input.date <= rule.validTo),
  )
  if (hasWeeklyRule || relevantExceptions.some((exception) => exception.kind === 'extra')) return { ok: true }
  return { ok: false, reason: 'not_operating_day' }
}

export function upcomingServiceDates(
  config: TransportScheduleConfig,
  input: { transferType: string; direction: Direction; originCode?: string; from: string; count: number; horizonDays?: number },
): string[] {
  dateParts(input.from)
  const horizonDays = input.horizonDays ?? 190
  const dates: string[] = []
  for (let offset = 0; offset <= horizonDays && dates.length < input.count; offset += 1) {
    const date = addDays(input.from, offset)
    if (checkServiceDate(config, { ...input, date }).ok) dates.push(date)
  }
  return dates
}

export function returnOptions(
  config: TransportScheduleConfig,
  input: { transferType: string; outboundDate: string; originCode?: string; count: number },
): string[] {
  return upcomingServiceDates(config, {
    transferType: input.transferType,
    direction: 'return',
    originCode: input.originCode,
    from: addDays(input.outboundDate, 1),
    count: input.count,
  })
}

export function patternsFor(config: TransportScheduleConfig, transferType: string): StayPattern[] {
  return config.stayPatterns
    .filter((pattern) => pattern.isActive && (pattern.transferType == null || pattern.transferType === transferType))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
}

/**
 * Finds the sellable stay pattern for a transport type and requested duration.
 * A null transfer type applies to every transfer. When more than one pattern
 * matches, the configured sort order is authoritative.
 */
export function findStayPattern(
  config: TransportScheduleConfig,
  input: { transferType: string; durationDays: number },
): StayPattern | null {
  return config.stayPatterns
    .filter(
      (pattern) =>
        pattern.isActive &&
        pattern.durationDays === input.durationDays &&
        (pattern.transferType == null || pattern.transferType === input.transferType),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))[0] ?? null
}

export function resolveStayPattern(
  config: TransportScheduleConfig,
  input: { patternCode: string; transferType: string; outboundDate: string; originCode?: string },
): StayPatternResult {
  const pattern = config.stayPatterns.find((candidate) => candidate.code === input.patternCode)
  if (!pattern) return { ok: false, reason: 'unknown_pattern' }
  if (!pattern.isActive) return { ok: false, reason: 'pattern_inactive' }
  if (pattern.transferType != null && pattern.transferType !== input.transferType) {
    return { ok: false, reason: 'pattern_transfer_type_mismatch' }
  }
  if (pattern.departureWeekdays != null && !pattern.departureWeekdays.includes(weekdayForDate(input.outboundDate))) {
    return { ok: false, reason: 'invalid_departure_weekday' }
  }
  if (!checkServiceDate(config, { ...input, direction: 'outbound', date: input.outboundDate }).ok) {
    return { ok: false, reason: 'outbound_not_operating' }
  }
  const returnDate = addDays(input.outboundDate, pattern.returnOffsetDays)
  if (!checkServiceDate(config, { ...input, direction: 'return', date: returnDate }).ok) {
    return { ok: false, reason: 'return_not_operating' }
  }
  return { ok: true, returnDate, nights: pattern.nights, durationDays: pattern.durationDays }
}

export function isRecommendedCheckIn(config: TransportScheduleConfig, date: string): boolean {
  return config.recommendedCheckInWeekdays.includes(weekdayForDate(date))
}
