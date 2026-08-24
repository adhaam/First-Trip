import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { experienceDateUpdateSchema } from '@/lib/experiences-schema'
import { getDateAvailability } from '@/lib/experiences-data'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = experienceDateUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const patch = validated.data
  const current = await getDateAvailability(id)
  if (!current) {
    return NextResponse.json({ error: 'Trip date not found' }, { status: 404 })
  }

  const start = patch.start_date ?? current.start_date
  const end = patch.end_date ?? current.end_date
  if (end < start) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
  }
  // Shrinking capacity below what is already booked would make the public
  // "spots left" number lie, so block it and tell the admin the floor.
  if (patch.total_spots !== undefined && patch.total_spots < current.spots_taken) {
    return NextResponse.json(
      { error: `Cannot set capacity below ${current.spots_taken} already-booked spots` },
      { status: 409 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('experience_dates').update(patch).eq('id', id).select().single()
  if (error) {
    console.error('PATCH experience_date error:', error)
    return NextResponse.json({ error: 'Failed to update trip date' }, { status: 500 })
  }
  return NextResponse.json({ date: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { count } = await supabase
    .from('experience_bookings')
    .select('id', { count: 'exact', head: true })
    .eq('experience_date_id', id)
    .neq('status', 'cancelled')

  const force = new URL(req.url).searchParams.get('force') === 'true'
  if ((count ?? 0) > 0 && !force) {
    return NextResponse.json(
      { error: 'Trip date has active bookings', bookings: count, hint: 'Cancel it instead, or retry with ?force=true' },
      { status: 409 },
    )
  }

  const { error } = await supabase.from('experience_dates').delete().eq('id', id)
  if (error) {
    console.error('DELETE experience_date error:', error)
    return NextResponse.json({ error: 'Failed to delete trip date' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
