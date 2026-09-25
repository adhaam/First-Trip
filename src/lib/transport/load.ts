import 'server-only'

import { DEFAULT_TRANSPORT_SCHEDULE } from './defaults'
import type { DateException, StayPattern, TransportScheduleConfig, TransportService, WeeklyRule } from './schedule'
import { getSupabaseAdmin, isSupabaseConfigured } from '../supabase'

type RawRow = Record<string, unknown>
type QueryResult = { data: RawRow[] | null; error: { code?: string; message?: string } | null }

const MISSING_SCHEMA_CODES = new Set(['42P01', 'PGRST205', '42703'])

function isMissingSchema(error: QueryResult['error']): boolean {
  return error != null && (MISSING_SCHEMA_CODES.has(error.code ?? '') || /does not exist|schema cache/i.test(error.message ?? ''))
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function cloneDefault(): TransportScheduleConfig {
  return {
    services: DEFAULT_TRANSPORT_SCHEDULE.services.map((service) => ({ ...service })),
    weeklyRules: DEFAULT_TRANSPORT_SCHEDULE.weeklyRules.map((rule) => ({ ...rule })),
    exceptions: [],
    stayPatterns: DEFAULT_TRANSPORT_SCHEDULE.stayPatterns.map((pattern) => ({
      ...pattern,
      departureWeekdays: pattern.departureWeekdays == null ? null : [...pattern.departureWeekdays],
    })),
    recommendedCheckInWeekdays: [...DEFAULT_TRANSPORT_SCHEDULE.recommendedCheckInWeekdays],
  }
}

function serviceFromRow(row: RawRow): TransportService {
  const transferType = String(row.transfer_type)
  const defaultMode = DEFAULT_TRANSPORT_SCHEDULE.services.find((service) => service.transferType === transferType)?.scheduleMode ?? 'on_demand'
  return {
    transferType,
    isActive: Boolean(row.is_active),
    scheduleMode: row.schedule_mode === 'scheduled' || row.schedule_mode === 'on_demand' ? row.schedule_mode : defaultMode,
  }
}

function mergeServices(defaultConfig: TransportScheduleConfig, rows: RawRow[] | null): TransportScheduleConfig {
  if (!rows) return defaultConfig
  const replacements = rows.map(serviceFromRow)
  const byType = new Map(replacements.map((service) => [service.transferType, service]))
  return {
    ...defaultConfig,
    services: [
      ...defaultConfig.services.map((service) => byType.get(service.transferType) ?? service),
      ...replacements.filter((service) => !defaultConfig.services.some((defaultService) => defaultService.transferType === service.transferType)),
    ],
  }
}

function weeklyRuleFromRow(row: RawRow): WeeklyRule {
  return {
    transferType: String(row.transfer_type), direction: row.direction as WeeklyRule['direction'], weekday: Number(row.weekday),
    originGovernorateCode: row.origin_governorate_code as string | null, validFrom: row.valid_from as string | null,
    validTo: row.valid_to as string | null, isActive: Boolean(row.is_active),
  }
}

function exceptionFromRow(row: RawRow): DateException {
  return {
    transferType: String(row.transfer_type), direction: row.direction as DateException['direction'], serviceDate: String(row.service_date),
    kind: row.kind as DateException['kind'], originGovernorateCode: row.origin_governorate_code as string | null, isActive: Boolean(row.is_active),
  }
}

function stayPatternFromRow(row: RawRow): StayPattern {
  return {
    code: String(row.code), transferType: row.transfer_type as string | null, nameAr: String(row.name_ar ?? ''), nameEn: String(row.name_en ?? ''),
    durationDays: Number(row.duration_days), nights: Number(row.nights), returnOffsetDays: Number(row.return_offset_days),
    departureWeekdays: Array.isArray(row.departure_weekdays) ? row.departure_weekdays.map(Number) : null,
    isActive: Boolean(row.is_active), sortOrder: Number(row.sort_order ?? 0),
  }
}

/** Server-only data loader. The pure schedule functions intentionally take this result as an explicit argument. */
export async function getTransportSchedule(): Promise<TransportScheduleConfig> {
  const defaults = cloneDefault()
  if (!isSupabaseConfigured()) return defaults

  const supabase = getSupabaseAdmin()
  const yesterday = addUtcDays(todayUtc(), -1)
  const [services, weeklyRules, exceptions, stayPatterns, siteSettings] = await Promise.all([
    supabase.from('transfer_settings').select('transfer_type, is_active, schedule_mode'),
    supabase.from('transport_weekly_rules').select('transfer_type, direction, weekday, origin_governorate_code, valid_from, valid_to, is_active'),
    supabase.from('transport_date_exceptions').select('transfer_type, direction, service_date, kind, origin_governorate_code, is_active').gte('service_date', yesterday),
    supabase.from('stay_patterns').select('code, transfer_type, name_ar, name_en, duration_days, nights, return_offset_days, departure_weekdays, is_active, sort_order'),
    supabase.from('site_settings').select('recommended_check_in_weekdays').eq('id', 1).maybeSingle(),
  ])

  const results = [services, weeklyRules, exceptions, stayPatterns, siteSettings] as QueryResult[]
  if (results.some((result) => isMissingSchema(result.error))) {
    console.warn('Transport schedule tables are unavailable; using the migration 029 default schedule.')
    return mergeServices(defaults, services.data as RawRow[] | null)
  }
  if (results.some((result) => result.error)) {
    console.error('getTransportSchedule error:', results.find((result) => result.error)?.error)
    return mergeServices(defaults, services.data as RawRow[] | null)
  }

  const siteSetting = siteSettings.data as RawRow | null
  return {
    services: (services.data ?? []).map(serviceFromRow),
    weeklyRules: (weeklyRules.data ?? []).map(weeklyRuleFromRow),
    exceptions: (exceptions.data ?? []).map(exceptionFromRow),
    stayPatterns: (stayPatterns.data ?? []).map(stayPatternFromRow),
    recommendedCheckInWeekdays: Array.isArray(siteSetting?.recommended_check_in_weekdays)
      ? siteSetting.recommended_check_in_weekdays.map(Number)
      : defaults.recommendedCheckInWeekdays,
  }
}

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}
