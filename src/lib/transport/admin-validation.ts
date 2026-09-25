/**
 * Validation for the Operations Center transport configuration (migration 029
 * tables). Pure, so the routes and the tests share one definition.
 *
 * Two concepts stay separate on purpose:
 *   - OPERATING SCHEDULE: when a service runs (weekly rules + date exceptions).
 *   - COMMERCIAL STAY PATTERNS: which outbound/return combinations are sold.
 * The only link checked here is the one that would make a product unsellable:
 * a stay pattern on a scheduled service must depart on a weekday with an
 * outbound rule and come back on a weekday with a return rule.
 */
import { z } from 'zod'
import type { TransportScheduleConfig, WeeklyRule } from './schedule'

// A real calendar date: Date.parse alone accepts 2026-02-30 and rolls it over.
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Invalid date')
const governorate = z.string().trim().min(1).max(40).nullable().optional()
const transferType = z.string().trim().min(1).max(40)
const weekday = z.number().int().min(0).max(6)

export const scheduleModeSchema = z.object({ schedule_mode: z.enum(['scheduled', 'on_demand']) }).strict()

export const weeklyRuleCreateSchema = z.object({
  transfer_type: transferType,
  direction: z.enum(['outbound', 'return']),
  weekday,
  origin_governorate_code: governorate,
  valid_from: isoDate.nullable().optional(),
  valid_to: isoDate.nullable().optional(),
  is_active: z.boolean().default(true),
  notes: z.string().max(300).default(''),
}).strict().refine(
  (rule) => !rule.valid_from || !rule.valid_to || rule.valid_to >= rule.valid_from,
  { message: 'valid_to must be on or after valid_from', path: ['valid_to'] },
)

export const weeklyRuleUpdateSchema = z.object({
  origin_governorate_code: governorate,
  valid_from: isoDate.nullable().optional(),
  valid_to: isoDate.nullable().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().max(300).optional(),
}).strict()

export const exceptionCreateSchema = z.object({
  transfer_type: transferType,
  direction: z.enum(['outbound', 'return', 'both']),
  service_date: isoDate,
  kind: z.enum(['blackout', 'extra']),
  origin_governorate_code: governorate,
  reason_ar: z.string().trim().max(300).default(''),
  reason_en: z.string().trim().max(300).default(''),
  is_active: z.boolean().default(true),
}).strict()

export const exceptionUpdateSchema = z.object({
  reason_ar: z.string().trim().max(300).optional(),
  reason_en: z.string().trim().max(300).optional(),
  is_active: z.boolean().optional(),
}).strict()

const weekdayList = z.array(weekday).min(1).max(7)
  .refine((days) => new Set(days).size === days.length, 'Duplicate weekday')
  .transform((days) => [...days].sort((a, b) => a - b))

const stayPatternFields = {
  transfer_type: transferType.nullable(),
  name_ar: z.string().trim().min(1).max(80),
  name_en: z.string().trim().min(1).max(80),
  duration_days: z.number().int().min(1).max(60),
  nights: z.number().int().min(0).max(59),
  return_offset_days: z.number().int().min(1).max(60),
  departure_weekdays: weekdayList.nullable(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(1000),
}

function nightsFit(pattern: { nights?: number; duration_days?: number }): boolean {
  return pattern.nights === undefined || pattern.duration_days === undefined || pattern.nights < pattern.duration_days
}

export const stayPatternCreateSchema = z.object({
  code: z.string().regex(/^[a-z0-9_]{2,40}$/, 'Lowercase letters, digits and underscores'),
  ...stayPatternFields,
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(1000).default(0),
}).strict().refine(nightsFit, { message: 'nights must be less than duration_days', path: ['nights'] })

export const stayPatternUpdateSchema = z.object(stayPatternFields).partial().strict()

export type StayPatternInput = {
  code: string
  transfer_type: string | null
  return_offset_days: number
  departure_weekdays: number[] | null
  is_active: boolean
}

export type OperabilityProblem = { transfer_type: string; weekday: number; direction: 'outbound' | 'return' }

function hasActiveRule(rules: WeeklyRule[], type: string, direction: 'outbound' | 'return', day: number): boolean {
  return rules.some((rule) => rule.isActive && rule.transferType === type && rule.direction === direction
    && rule.weekday === day)
}

/**
 * A pattern is sellable on a scheduled service when each departure weekday has
 * an active outbound rule and the return weekday has an active return rule. A
 * season-limited rule still counts for its weekday (the Builder then offers
 * only the in-season dates). On-demand services run any day. An inactive
 * pattern is never checked — it is not being sold.
 */
export function checkStayPatternOperable(
  config: Pick<TransportScheduleConfig, 'services' | 'weeklyRules'>,
  pattern: StayPatternInput,
): { ok: true } | { ok: false; problems: OperabilityProblem[] } {
  if (!pattern.is_active) return { ok: true }
  const services = config.services.filter((service) => service.isActive
    && (pattern.transfer_type === null || service.transferType === pattern.transfer_type))
  const problems: OperabilityProblem[] = []

  for (const service of services) {
    if (service.scheduleMode !== 'scheduled') continue
    const outboundDays = pattern.departure_weekdays
      ?? config.weeklyRules
        .filter((rule) => rule.isActive && rule.transferType === service.transferType && rule.direction === 'outbound')
        .map((rule) => rule.weekday)
    for (const day of new Set(outboundDays)) {
      if (!hasActiveRule(config.weeklyRules, service.transferType, 'outbound', day)) {
        problems.push({ transfer_type: service.transferType, weekday: day, direction: 'outbound' })
        continue
      }
      const returnDay = (day + pattern.return_offset_days) % 7
      if (!hasActiveRule(config.weeklyRules, service.transferType, 'return', returnDay)) {
        problems.push({ transfer_type: service.transferType, weekday: returnDay, direction: 'return' })
      }
    }
  }
  return problems.length ? { ok: false, problems } : { ok: true }
}

/**
 * Stay patterns that would stop being sellable if `config` changed as given.
 * Used before deactivating or deleting a weekly rule or changing a service's
 * schedule mode.
 */
export function patternsBrokenBy(
  config: TransportScheduleConfig,
): { code: string; problems: OperabilityProblem[] }[] {
  return config.stayPatterns.flatMap((pattern) => {
    const result = checkStayPatternOperable(config, {
      code: pattern.code,
      transfer_type: pattern.transferType ?? null,
      return_offset_days: pattern.returnOffsetDays,
      departure_weekdays: pattern.departureWeekdays ?? null,
      is_active: pattern.isActive,
    })
    return result.ok ? [] : [{ code: pattern.code, problems: result.problems }]
  })
}
