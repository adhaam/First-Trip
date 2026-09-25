import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { BOOKING_SOURCES } from '@/lib/booking-sources'
import { STATUSES } from '@/lib/request-workflow'
import { updateAdminStatus } from '@/lib/admin-status-update'

const updateSchema = z.object({
  status: z.enum(STATUSES.accommodation_booking).optional(),
  customer_name: z.string().min(2).max(100).optional(),
  customer_phone: z.string().min(6).max(20).optional(),
  customer_email: z.string().email().optional().or(z.literal('')),
  notes: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  return_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  num_people: z.number().int().min(1).max(50).optional(),
  total_price: z.number().min(0).optional(),
  // Manual payment tracking: remaining balance = total_price - amount_paid
  // (computed in the UI — never stored, so it can't drift).
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  source: z.enum(BOOKING_SOURCES).optional(),
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
  const { customer_email, trip_date, return_date, ...rest } = validated.data
  const patch: Record<string, unknown> = { ...rest }
  if (customer_email !== undefined) patch.customer_email = customer_email || null
  if (trip_date !== undefined) patch.trip_date = trip_date || null
  if (return_date !== undefined) patch.return_date = return_date || null

  const supabase = getSupabaseAdmin(gate.staff)
  const result = await updateAdminStatus({
    readStatus: async (bookingId) => supabase.from('bookings').select('status').eq('id', bookingId).maybeSingle(),
    update: async (bookingId, updatePatch, currentStatus) => {
      let query = supabase.from('bookings').update(updatePatch).eq('id', bookingId)
      if (currentStatus !== undefined) query = query.eq('status', currentStatus)
      return query.select('*, accommodations(name_ar, name_en)').maybeSingle()
    },
  }, 'accommodation_booking', id, patch)

  if (result.kind === 'invalid_transition') {
    return NextResponse.json({ error: 'Invalid status transition', code: result.kind, allowed: result.allowed }, { status: 409 })
  }
  if (result.kind === 'stale_status') {
    return NextResponse.json({ error: 'Booking status changed by another admin', code: result.kind }, { status: 409 })
  }
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (result.kind === 'error') {
    console.error('PATCH booking error:', result.error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
  return NextResponse.json({ booking: result.data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { error } = await supabase.from('bookings').delete().eq('id', id)
  if (error) {
    console.error('DELETE booking error:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
