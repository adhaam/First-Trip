import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone } from '@/lib/customer'
import { getDateAvailability } from '@/lib/experiences-data'

/**
 * Bookings for the admin table. Optional `?experience_id=` / `?date_id=` /
 * `?status=` filters; newest first. CSV export happens client-side from this
 * same payload so the exported rows always match what's on screen.
 */
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const experienceId = url.searchParams.get('experience_id')
  const dateId = url.searchParams.get('date_id')
  const status = url.searchParams.get('status')

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('experience_bookings')
    .select('*, experiences(title_ar, title_en, slug), experience_dates(start_date, end_date, total_spots)')
    .order('created_at', { ascending: false })
    .limit(1000)

  if (experienceId) query = query.eq('experience_id', experienceId)
  if (dateId) query = query.eq('experience_date_id', dateId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) {
    console.error('GET experience_bookings error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
  return NextResponse.json({ bookings: data ?? [] })
}

const manualBookingSchema = z.object({
  experience_date_id: z.string().uuid(),
  full_name: z.string().min(1).max(100),
  phone: z.string().min(6).max(25),
  email: z.string().email().optional().or(z.literal('')),
  spots_requested: z.number().int().min(1).max(50),
  notes: z.string().max(600).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled']).optional().default('confirmed'),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional().default('unpaid'),
  amount_paid: z.number().min(0).optional(),
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other']).optional(),
  payment_received_by: z.string().max(200).optional(),
  discount_value: z.number().min(0).optional(),
  discount_type: z.enum(['amount', 'percentage']).optional(),
})

/**
 * Manual booking entry — for Signature Experience spots Adham sells over the
 * phone / WhatsApp / in person. Reuses the exact same price-per-spot +
 * availability logic as the public booking route so the total is never
 * guessed by hand; the admin can still set status/payment directly since a
 * manual entry usually means the sale (and payment) already happened.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = manualBookingSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const input = validated.data

  const availability = await getDateAvailability(input.experience_date_id)
  if (!availability) {
    return NextResponse.json({ error: 'Trip date not found' }, { status: 404 })
  }
  if (input.status !== 'cancelled' && input.spots_requested > availability.spots_remaining) {
    return NextResponse.json(
      { error: `Only ${availability.spots_remaining} spots left for this date` },
      { status: 409 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data: experience } = await supabase
    .from('experiences')
    .select('id, title_ar, title_en, price, currency')
    .eq('id', availability.experience_id)
    .maybeSingle()
  if (!experience) {
    return NextResponse.json({ error: 'Experience not found' }, { status: 404 })
  }

  // Auto-calculated price — never typed in by hand.
  const unitPrice = availability.price_override ?? Number(experience.price ?? 0)
  const quotedPrice = unitPrice * input.spots_requested

  const customer = await findOrCreateCustomerByPhone({
    phone: input.phone,
    name: input.full_name,
    email: input.email || null,
  })

  const { data, error } = await supabase
    .from('experience_bookings')
    .insert({
      experience_id: experience.id,
      experience_date_id: input.experience_date_id,
      customer_id: customer.id,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email || '',
      spots_requested: input.spots_requested,
      notes: input.notes || '',
      quoted_price: quotedPrice,
      currency: experience.currency || 'EGP',
      status: input.status,
      payment_status: input.payment_status,
      amount_paid: input.amount_paid || 0,
      payment_channel: input.payment_channel || null,
      payment_received_by: input.payment_received_by || null,
      discount_value: input.discount_value ?? null,
      discount_type: input.discount_type ?? null,
      source: 'manual',
    })
    .select('*, experiences(title_ar, title_en, slug), experience_dates(start_date, end_date, total_spots)')
    .single()

  if (error) {
    console.error('POST manual experience_booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  return NextResponse.json({ booking: data }, { status: 201 })
}
