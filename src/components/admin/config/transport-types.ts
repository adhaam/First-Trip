// Shared shapes for the Transport configuration screen (docs/m3/OPS_API_CONTRACT.md,
// "Transport configuration" section). Kept separate so both panel files can import them
// without a circular dependency on the main TransportScheduleManager.

export type ScheduleMode = 'scheduled' | 'on_demand'
export type RuleDirection = 'outbound' | 'return'
export type ExceptionDirection = 'outbound' | 'return' | 'both'
export type ExceptionKind = 'blackout' | 'extra'

export interface TransportService {
  transfer_type: string
  name_ar: string
  name_en: string
  schedule_mode: ScheduleMode
  is_active: boolean
}

export interface WeeklyRule {
  id: string
  transfer_type: string
  direction: RuleDirection
  weekday: number
  origin_governorate_code: string | null
  valid_from: string | null
  valid_to: string | null
  is_active: boolean
  notes: string | null
}

export interface TransportException {
  id: string
  transfer_type: string
  direction: ExceptionDirection
  service_date: string
  kind: ExceptionKind
  origin_governorate_code: string | null
  reason_ar: string
  reason_en: string
  is_active: boolean
}

export interface StayPattern {
  code: string
  transfer_type: string | null
  name_ar: string
  name_en: string
  duration_days: number
  nights: number
  return_offset_days: number
  departure_weekdays: number[] | null
  is_active: boolean
  sort_order: number
}

export interface Governorate {
  code: string
  name_ar: string
  name_en: string
}

export interface PreviewEntry {
  transfer_type: string
  direction: string
  dates: string[]
}

export interface TransportData {
  services: TransportService[]
  weekly_rules: WeeklyRule[]
  exceptions: TransportException[]
  stay_patterns: StayPattern[]
  governorates: Governorate[]
  preview: PreviewEntry[]
}

export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const

export type TransportApiError = Error & { code?: string; details?: unknown }

type Problem = { transfer_type?: string; weekday?: number; direction?: string }
type Translate = (key: string, values?: Record<string, string | number>) => string

function problemText(problem: Problem, data: TransportData, locale: string, t: Translate): string {
  const service = data.services.find((s) => s.transfer_type === problem.transfer_type)
  const serviceName = service ? (locale === 'ar' ? service.name_ar : service.name_en) : problem.transfer_type ?? ''
  const weekday = typeof problem.weekday === 'number' ? t(`weekdays.${problem.weekday}`) : '—'
  const direction = problem.direction === 'return' ? t('schedule.directionReturn') : t('schedule.directionOutbound')
  return t('errors.problem', { service: serviceName, direction, weekday })
}

/**
 * Localised explanation of a transport API error. `t` is scoped to
 * 'opsConfig.transport'. Details shapes come from
 * src/app/api/admin/transport/** (pattern_not_operable: Problem[],
 * pattern_depends_on_rule: { code, problems: Problem[] }[]).
 */
export function describeTransportError(error: unknown, data: TransportData, locale: string, t: Translate): string {
  const e = error as TransportApiError
  if (e.code === 'pattern_not_operable' && Array.isArray(e.details)) {
    const problems = (e.details as Problem[]).map((p) => problemText(p, data, locale, t))
    return t('errors.notOperable', { problems: problems.join(' · ') })
  }
  if (e.code === 'pattern_depends_on_rule' && Array.isArray(e.details)) {
    const entries = e.details as { code?: string; problems?: Problem[] }[]
    const names = entries.map((entry) => {
      const pattern = data.stay_patterns.find((p) => p.code === entry.code)
      return pattern ? (locale === 'ar' ? pattern.name_ar : pattern.name_en) : entry.code ?? ''
    })
    return t('errors.dependsOnRule', { patterns: names.join('، ') })
  }
  if (e.code === 'duplicate') return t('errors.duplicate')
  if (e.code === 'invalid') return t('errors.invalid')
  if (e.code === 'forbidden') return t('errors.forbidden')
  return t('errors.generic')
}
