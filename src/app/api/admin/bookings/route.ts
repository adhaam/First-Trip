import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  // Joined accommodation name so the dashboard can show/filter by hotel
  // without a second round trip per row.
  const { data, error } = await supabase
    .from('bookings')
    .select('*, accommodations(name_ar, name_en)')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) {
    console.error('GET bookings error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
  return NextResponse.json({ bookings: data })
}

// Manual booking entry — for bookings Adham takes over the phone / WhatsApp /
// in person, so the dashboard stays the single source of truth for every
// booking regardless of where it came from. Admin-only, no rate limit, and
// skips the public-form validation (dates aren't restricted to Sun/Thu here
// since a manual booking can be anything the admin agreed to).
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const manualBookingSchema = z.object({
  customer_name: z.string().min(2).max(100),
  customer_phone: z.string().min(6).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  accommodation_id: z.string().uuid().optional().or(z.literal('')),
  governorate: z.string().max(40).optional().or(z.literal('')),
  trip_date: isoDate.optional().or(z.literal('')),
  return_date: isoDate.optional().or(z.literal('')),
  duration: z.union([z.literal(4), z.literal(5)]).optional(),
  nights: z.number().int().min(1).max(60).optional(),
  transfer_type: z.enum(['package_bus', 'hiace']).optional(),
  transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  room_type: z.enum(['double', 'single', 'triple']).optional(),
  meal_plan_key: z.string().optional().or(z.literal('')),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
  status: z.enum(['new', 'pending', 'confirmed', 'cancelled', 'completed']).optional().default('confirmed'),
  total_price: z.number().min(0).optional(),
  // Manual payment tracking — no gateway, just the owner's own records.
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  // Payment tracking
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other']).optional(),
  payment_received_by: z.string().max(200).optional(),
  payment_date: z.string().optional(),
  payment_notes: z.string().max(1000).optional(),
  // Booking-level discount
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  // Where this booking actually came from (manual entry can be any channel).
  source: z.enum(['manual', 'whatsapp', 'instagram', 'facebook', 'referral', 'other']).optional().default('manual'),
})

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = manualBookingSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }

  const {
    customer_email, accommodation_id, governorate, trip_date, return_date,
    meal_plan_key, ...rest
  } = validated.data

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...rest,
      customer_email: customer_email || null,
      accommodation_id: accommodation_id || null,
      governorate: governorate || null,
      trip_date: trip_date || null,
      return_date: return_date || null,
      meal_plan_key: meal_plan_key || null,
    })
    .select('*, accommodations(name_ar, name_en)')
    .single()

  if (error) {
    console.error('POST manual booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Keep the customers table in sync, same as the public booking route.
  await supabase.from('customers').upsert(
    {
      name: validated.data.customer_name,
      phone: validated.data.customer_phone,
      email: customer_email || null,
    },
    { onConflict: 'phone', ignoreDuplicates: false },
  )

  return NextResponse.json({ booking: data }, { status: 201 })
}
