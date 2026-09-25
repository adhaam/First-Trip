import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTransportSchedule } from './load'
import { upcomingServiceDates, type Direction, type TransportScheduleConfig } from './schedule'
import { todayInCairo } from './today'
import { patternsBrokenBy } from './admin-validation'

// Shared by the /api/admin/transport routes. Reads the SAME configuration the
// public Trip Builder reads (getTransportSchedule), so the preview shown to
// staff is exactly what customers will be offered. /plan and the quote /
// trip-request APIs load the schedule per request (the plan page reads
// searchParams, so it is dynamic) — no cache needs revalidating after a write.

const PREVIEW_DAYS = 28

export function transportErrorResponse(error: { code?: string; message?: string }, context: string) {
  if (error.code === '23505') {
    return NextResponse.json({ error: 'Already exists', code: 'duplicate' }, { status: 409 })
  }
  if (error.code === '23503') {
    return NextResponse.json({ error: 'Unknown transport service', code: 'invalid' }, { status: 400 })
  }
  if (error.code === '23514') {
    return NextResponse.json({ error: error.message, code: 'invalid' }, { status: 400 })
  }
  if (error.code === 'PGRST205' || error.code === '42P01') {
    return NextResponse.json({ error: 'Migration pending', code: 'migration_pending' }, { status: 503 })
  }
  console.error(`${context} error:`, error)
  return NextResponse.json({ error: 'Failed to save transport configuration' }, { status: 500 })
}

export function invalidResponse(details: unknown) {
  return NextResponse.json({ error: 'Invalid data', code: 'invalid', details }, { status: 400 })
}

export function previewFor(config: TransportScheduleConfig, from = todayInCairo()) {
  const directions: Direction[] = ['outbound', 'return']
  return config.services
    .filter((service) => service.isActive)
    .flatMap((service) => directions.map((direction) => ({
      transfer_type: service.transferType,
      direction,
      dates: upcomingServiceDates(config, {
        transferType: service.transferType, direction, from, count: PREVIEW_DAYS, horizonDays: PREVIEW_DAYS - 1,
      }),
    })))
}

/**
 * Applies a proposed change to the live configuration in memory and returns
 * the active stay patterns it would make unsellable. Used before a weekly rule
 * is deactivated/deleted or a service's schedule mode changes.
 */
export async function patternsBrokenByChange(change: (config: TransportScheduleConfig) => void) {
  const config = await getTransportSchedule()
  const before = new Set(patternsBrokenBy(config).map((entry) => entry.code))
  change(config)
  // Patterns already broken before the change are not blamed on it.
  return patternsBrokenBy(config).filter((entry) => !before.has(entry.code))
}

export function dependsOnRuleResponse(broken: { code: string; problems: unknown[] }[]) {
  return NextResponse.json({
    error: 'Active stay patterns depend on this service day',
    code: 'pattern_depends_on_rule',
    details: broken,
  }, { status: 422 })
}

export async function loadGovernorates(supabase: SupabaseClient) {
  const { data } = await supabase
    .from('transfer_governorate_pricing')
    .select('governorate_code, name_ar, name_en, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  const seen = new Map<string, { code: string; name_ar: string; name_en: string }>()
  for (const row of data ?? []) {
    if (!seen.has(row.governorate_code)) {
      seen.set(row.governorate_code, { code: row.governorate_code, name_ar: row.name_ar, name_en: row.name_en })
    }
  }
  return [...seen.values()]
}
