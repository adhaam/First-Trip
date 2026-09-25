import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { WeeklyRule } from '@/lib/transport/schedule'
import { weeklyRuleUpdateSchema } from '@/lib/transport/admin-validation'
import {
  dependsOnRuleResponse, invalidResponse, patternsBrokenByChange, transportErrorResponse,
} from '@/lib/transport/admin.server'

type RuleRow = {
  transfer_type: string
  direction: 'outbound' | 'return'
  weekday: number
  origin_governorate_code: string | null
  valid_from: string | null
  valid_to: string | null
}

// The loaded schedule has no rule ids; its unique key (migration 029) is the
// combination of these fields, so matching on them finds exactly this rule.
function sameRule(rule: WeeklyRule, row: RuleRow): boolean {
  return rule.transferType === row.transfer_type && rule.direction === row.direction && rule.weekday === row.weekday
    && (rule.originGovernorateCode ?? null) === row.origin_governorate_code
    && (rule.validFrom ?? null) === row.valid_from && (rule.validTo ?? null) === row.valid_to
}

function loadRule(supabase: ReturnType<typeof getSupabaseAdmin>, id: string) {
  return supabase
    .from('transport_weekly_rules')
    .select('transfer_type, direction, weekday, origin_governorate_code, valid_from, valid_to')
    .eq('id', id)
    .maybeSingle<RuleRow>()
}

/** Stay patterns that would lose their service day if this rule stopped running. */
function brokenWithout(row: RuleRow) {
  return patternsBrokenByChange((config) => {
    config.weeklyRules = config.weeklyRules.map((rule) => sameRule(rule, row) ? { ...rule, isActive: false } : rule)
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const parsed = weeklyRuleUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())
  const supabase = getSupabaseAdmin(gate.staff)

  const current = await loadRule(supabase, id)
  if (current.error) return transportErrorResponse(current.error, 'PATCH weekly rule')
  if (!current.data) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  const from = parsed.data.valid_from !== undefined ? parsed.data.valid_from : current.data.valid_from
  const to = parsed.data.valid_to !== undefined ? parsed.data.valid_to : current.data.valid_to
  if (from && to && to < from) {
    return invalidResponse({ fieldErrors: { valid_to: ['valid_to must be on or after valid_from'] } })
  }
  if (parsed.data.is_active === false) {
    const broken = await brokenWithout(current.data)
    if (broken.length) return dependsOnRuleResponse(broken)
  }

  const { data, error } = await supabase
    .from('transport_weekly_rules').update(parsed.data).eq('id', id).select('*').maybeSingle()
  if (error) return transportErrorResponse(error, 'PATCH weekly rule')
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)

  const current = await loadRule(supabase, id)
  if (current.error) return transportErrorResponse(current.error, 'DELETE weekly rule')
  if (!current.data) return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
  const broken = await brokenWithout(current.data)
  if (broken.length) return dependsOnRuleResponse(broken)

  const { error } = await supabase.from('transport_weekly_rules').delete().eq('id', id)
  if (error) return transportErrorResponse(error, 'DELETE weekly rule')
  return NextResponse.json({ success: true })
}
