import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { experienceBookingUpdateSchema } from '@/lib/experiences-schema'
import { getDateAvailability } from '@/lib/experiences-data'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = experienceBookingUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid status', details: validated.error.flatten() }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: booking } = await supabase
    .from('experience_bookings')
    .select('id, status, spots_requested, experience_date_id')
    .eq('id', id)
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  // Re-opening a cancelled booking claims spots again — only allow it if the
  // date still has room for them.
  if (validated.data.status && booking.status === 'cancelled' && validated.data.status !== 'cancelled') {
    const availability = await getDateAvailability(String(booking.experience_date_id))
    if (availability && availability.spots_remaining < Number(booking.spots_requested)) {
      return NextResponse.json(
        { error: `Only ${availability.spots_remaining} spots left — cannot restore this booking` },
        { status: 409 },
      )
    }
  }

  const { data, error } = await supabase
    .from('experience_bookings')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('PATCH experience_booking error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }
  return NextResponse.json({ booking: data })
}
