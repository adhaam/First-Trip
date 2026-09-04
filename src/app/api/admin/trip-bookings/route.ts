import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildTripPriceSnapshot, effectiveTripPrice } from '@/lib/pricing'

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
  /**
   * Honour the client-sent quoted_price only when the employee explicitly
   * overrode the calculated one. Otherwise the server prices the booking
   * itself — this route previously trusted whatever number arrived.
   */
  price_override: z.boolean().optional(),
  price_override_reason: z.string().max(300).optional(),
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

  // Price the booking from the trip's own row, applying any active discount,
  // and freeze the result — the invoice reads this snapshot, and a discount
  // that changes later must not move an existing booking's price.
  const { data: trip, error: tripError } = await supabase
    .from('sinai_trips')
    .select('id, price, discount_type, discount_value, discount_starts_at, discount_ends_at')
    .eq('id', parsed.data.trip_id)
    .single()
  if (tripError || !trip) {
    return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
  }

  const priced = effectiveTripPrice(trip)
  const snapshot = buildTripPriceSnapshot(priced, parsed.data.num_people)
  const useOverride = parsed.data.price_override && parsed.data.quoted_price != null
  const quotedPrice = useOverride ? parsed.data.quoted_price! : snapshot.total

  const { data, error } = await supabase
    .from('trip_bookings')
    .insert({
      customer_name: parsed.data.customer_name,
      customer_phone: parsed.data.customer_phone,
      trip_id: parsed.data.trip_id,
      preferred_date: parsed.data.preferred_date || null,
      num_people: parsed.data.num_people,
      quoted_price: quotedPrice,
      price_snapshot: useOverride
        ? {
            ...snapshot,
            price_override: true,
            computed_total: snapshot.total,
            ...(parsed.data.price_override_reason
              ? { price_override_reason: parsed.data.price_override_reason }
              : {}),
            total: quotedPrice,
          }
        : snapshot,
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
