import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { checkStayPatternOperable, stayPatternUpdateSchema } from '@/lib/transport/admin-validation'
import { invalidResponse, transportErrorResponse } from '@/lib/transport/admin.server'

// Stay patterns are deactivated, never deleted: submitted trip requests
// reference them (trip_requests.stay_pattern_code).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { code } = await params
  const parsed = stayPatternUpdateSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalidResponse(parsed.error.flatten())
  const supabase = getSupabaseAdmin(gate.staff)

  const { data: current, error: readError } = await supabase
    .from('stay_patterns').select('*').eq('code', code).maybeSingle()
  if (readError) return transportErrorResponse(readError, 'PATCH stay pattern')
  if (!current) return NextResponse.json({ error: 'Stay pattern not found' }, { status: 404 })

  const next = { ...current, ...parsed.data }
  if (next.nights >= next.duration_days) {
    return invalidResponse({ fieldErrors: { nights: ['nights must be less than duration_days'] } })
  }
  const operable = checkStayPatternOperable(await getTransportSchedule(), {
    code,
    transfer_type: next.transfer_type,
    return_offset_days: next.return_offset_days,
    departure_weekdays: next.departure_weekdays,
    is_active: next.is_active,
  })
  if (!operable.ok) {
    return NextResponse.json({
      error: 'No transport service on these days', code: 'pattern_not_operable', details: operable.problems,
    }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('stay_patterns').update(parsed.data).eq('code', code).select('*').maybeSingle()
  if (error) return transportErrorResponse(error, 'PATCH stay pattern')
  return NextResponse.json({ stay_pattern: data })
}
