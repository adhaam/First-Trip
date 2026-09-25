import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { weeklyRuleCreateSchema } from '@/lib/transport/admin-validation'
import { invalidResponse, transportErrorResponse } from '@/lib/transport/admin.server'

/** Adds a weekday on which a scheduled service runs (adding a day never breaks a stay pattern). */
export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = weeklyRuleCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('transport_weekly_rules')
    .insert({ ...parsed.data, origin_governorate_code: parsed.data.origin_governorate_code ?? null })
    .select('*')
    .single()
  if (error) return transportErrorResponse(error, 'POST weekly rule')
  return NextResponse.json({ rule: data }, { status: 201 })
}
