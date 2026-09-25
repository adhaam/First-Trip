import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { scheduleModeSchema } from '@/lib/transport/admin-validation'
import {
  dependsOnRuleResponse, invalidResponse, patternsBrokenByChange, transportErrorResponse,
} from '@/lib/transport/admin.server'

/** Scheduled (weekly rules) vs on-demand (any day except blackouts). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ transferType: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { transferType } = await params
  const parsed = scheduleModeSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())

  const broken = await patternsBrokenByChange((config) => {
    config.services = config.services.map((service) => service.transferType === transferType
      ? { ...service, scheduleMode: parsed.data.schedule_mode }
      : service)
  })
  if (broken.length) return dependsOnRuleResponse(broken)

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('transfer_settings')
    .update({ schedule_mode: parsed.data.schedule_mode })
    .eq('transfer_type', transferType)
    .select('transfer_type, name_ar, name_en, schedule_mode, is_active')
    .maybeSingle()
  if (error) return transportErrorResponse(error, 'PATCH transport service')
  if (!data) return NextResponse.json({ error: 'Transport service not found' }, { status: 404 })
  return NextResponse.json({ service: data })
}
