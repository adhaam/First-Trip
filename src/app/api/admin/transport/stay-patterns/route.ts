import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { checkStayPatternOperable, stayPatternCreateSchema } from '@/lib/transport/admin-validation'
import { invalidResponse, transportErrorResponse } from '@/lib/transport/admin.server'

/** A commercial stay pattern WEEMAP sells. It must match days the transport actually runs. */
export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = stayPatternCreateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())

  const operable = checkStayPatternOperable(await getTransportSchedule(), parsed.data)
  if (!operable.ok) {
    return NextResponse.json({
      error: 'No transport service on these days', code: 'pattern_not_operable', details: operable.problems,
    }, { status: 422 })
  }

  const { data, error } = await getSupabaseAdmin(gate.staff)
    .from('stay_patterns').insert(parsed.data).select('*').single()
  if (error) return transportErrorResponse(error, 'POST stay pattern')
  return NextResponse.json({ stay_pattern: data }, { status: 201 })
}
