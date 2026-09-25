import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { todayInCairo } from '@/lib/transport'
import { addDays } from '@/lib/transport/schedule'
import { loadGovernorates, previewFor, transportErrorResponse } from '@/lib/transport/admin.server'

// Transport operating schedule + commercial stay patterns for the Operations
// Center (migration 029). Everyone on staff can read; writes are owner/admin.
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const since = addDays(todayInCairo(), -30)

  const [services, rules, exceptions, patterns, governorates, config] = await Promise.all([
    supabase.from('transfer_settings').select('transfer_type, name_ar, name_en, schedule_mode, is_active')
      .order('transfer_type'),
    supabase.from('transport_weekly_rules').select('*').order('transfer_type').order('direction').order('weekday'),
    supabase.from('transport_date_exceptions').select('*').gte('service_date', since).order('service_date'),
    supabase.from('stay_patterns').select('*').order('sort_order'),
    loadGovernorates(supabase),
    getTransportSchedule(),
  ])
  const failed = [services, rules, exceptions, patterns].find((result) => result.error)
  if (failed?.error) return transportErrorResponse(failed.error, 'GET transport')

  return NextResponse.json({
    services: services.data,
    weekly_rules: rules.data,
    exceptions: exceptions.data,
    stay_patterns: patterns.data,
    governorates,
    preview: previewFor(config),
  })
}
