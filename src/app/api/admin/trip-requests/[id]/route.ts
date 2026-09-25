import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { STATUSES } from '@/lib/request-workflow'
import { updateAdminStatus } from '@/lib/admin-status-update'

// Status only. `notes` holds the customer's own words from the Trip Builder —
// there is no staff-notes column yet, so staff must not overwrite it here.
const updateSchema = z.object({
  status: z.enum(STATUSES.trip_request),
}).strict()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const result = await updateAdminStatus({
    readStatus: async (requestId) => supabase.from('trip_requests').select('status').eq('id', requestId).maybeSingle(),
    update: async (requestId, patch, currentStatus) => {
      let query = supabase.from('trip_requests').update(patch).eq('id', requestId)
      if (currentStatus !== undefined) query = query.eq('status', currentStatus)
      return query.select('*, accommodations(name_ar, name_en)').maybeSingle()
    },
  }, 'trip_request', id, validated.data)

  if (result.kind === 'invalid_transition') {
    return NextResponse.json({ error: 'Invalid status transition', code: result.kind, allowed: result.allowed }, { status: 409 })
  }
  if (result.kind === 'stale_status') {
    return NextResponse.json({ error: 'Trip request status changed by another admin', code: result.kind }, { status: 409 })
  }
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Trip request not found' }, { status: 404 })
  if (result.kind === 'error') {
    console.error('PATCH trip_request error:', result.error)
    return NextResponse.json({ error: 'Failed to update trip request' }, { status: 500 })
  }
  return NextResponse.json({ request: result.data })
}
