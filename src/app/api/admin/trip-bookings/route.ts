import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_bookings')
    .select('*, sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) {
    console.error('GET trip_bookings error:', error)
    return NextResponse.json({ error: 'Failed to load trip bookings' }, { status: 500 })
  }
  return NextResponse.json({ tripBookings: data })
}

const createSchema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().min(5),
  trip_id: z.string().uuid(),
  preferred_date: z.string().optional().nullable(),
  num_people: z.number().int().min(1).default(1),
  quoted_price: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_bookings')
    .insert({
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      trip_id: parsed.data.trip_id,
      preferred_date: parsed.data.preferred_date || null,
      num_people: parsed.data.num_people,
      quoted_price: parsed.data.quoted_price || null,
      notes: parsed.data.notes || null,
      status: 'new',
      context: 'standalone',
      source: 'admin',
      selected_options: {},
    })
    .select('*, sinai_trips(name_ar, name_en)')
    .single()
  if (error) {
    console.error('POST trip_booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }
  return NextResponse.json({ tripBooking: data }, { status: 201 })
}
