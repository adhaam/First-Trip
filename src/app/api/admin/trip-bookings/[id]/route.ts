import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { STATUSES } from '@/lib/request-workflow'
import { updateAdminStatus } from '@/lib/admin-status-update'

const updateSchema = z.object({
  status: z.enum(STATUSES.trip_booking).optional(),
  final_price: z.number().min(0).nullable().optional(),
  internal_notes: z.string().max(2000).optional(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  const result = await updateAdminStatus({
    readStatus: async (bookingId) => supabase.from('trip_bookings').select('status').eq('id', bookingId).maybeSingle(),
    update: async (bookingId, patch, currentStatus) => {
      let query = supabase.from('trip_bookings').update(patch).eq('id', bookingId)
      if (currentStatus !== undefined) query = query.eq('status', currentStatus)
      return query.select().maybeSingle()
    },
  }, 'trip_booking', id, validated.data)

  if (result.kind === 'invalid_transition') {
    return NextResponse.json({ error: 'Invalid status transition', code: result.kind, allowed: result.allowed }, { status: 409 })
  }
  if (result.kind === 'stale_status') {
    return NextResponse.json({ error: 'Trip booking status changed by another admin', code: result.kind }, { status: 409 })
  }
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Trip booking not found' }, { status: 404 })
  if (result.kind === 'error') {
    console.error('PATCH trip_booking error:', result.error)
    return NextResponse.json({ error: 'Failed to update trip booking' }, { status: 500 })
  }
  return NextResponse.json({ tripBooking: result.data })
}
