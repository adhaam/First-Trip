import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { computeQuote } from '@/lib/quote-service'
import type { PriceSnapshot } from '@/lib/types'

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
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  trip_package_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
  status: z.enum(['new', 'pending', 'confirmed', 'cancelled', 'completed']).optional().default('confirmed'),
  total_price: z.number().min(0).optional(),
  /**
   * Set only when the employee deliberately overrode the computed price for
   * an exceptional case. Without it a client-sent total_price is ignored in
   * favour of the server's own calculation, so a stale or tampered form
   * cannot decide what a customer is charged.
   */
  price_override: z.boolean().optional(),
  price_override_reason: z.string().max(300).optional(),
  // Manual payment tracking — no gateway, just the owner's own records.
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
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
    meal_plan_key, price_override, price_override_reason,
    extra_trip_ids, trip_package_ids, ...rest
  } = validated.data

  // ─── Authoritative pricing ───
  //
  // The dashboard shows the employee a preview from /api/admin/quote, but the
  // amount that lands on the row is recomputed here from DB rates — a preview
  // is never the source of a stored price. The resulting breakdown is frozen
  // into price_snapshot so the invoice can show the customer what they are
  // paying for; before this, manual bookings stored a bare number and every
  // invoice fell back to a single misleading "Accommodation" line.
  //
  // A quote needs a start date. Manual bookings genuinely may not have one
  // yet (a phone enquiry pencilled in), so pricing is best-effort: if it
  // can't be computed the typed total is kept and the booking still saves.
  let totalPrice = validated.data.total_price
  let priceSnapshot: PriceSnapshot | null = null
  let pricingNote: string | null = null

  if (trip_date) {
    const quoteResult = await computeQuote({
      booking_type: validated.data.booking_type,
      accommodation_id: accommodation_id || undefined,
      duration: validated.data.duration,
      nights: validated.data.nights,
      start_date: trip_date,
      transfer_type: validated.data.transfer_type,
      transfer_direction: validated.data.transfer_direction,
      governorate: governorate || undefined,
      room_type: validated.data.room_type,
      meal_plan_key: meal_plan_key || undefined,
      extra_trip_ids,
      trip_package_ids,
      num_people: validated.data.num_people,
    })

    if (quoteResult.ok) {
      priceSnapshot = quoteResult.snapshot
      if (price_override && validated.data.total_price !== undefined) {
        // Keep the computed breakdown alongside the overridden total so the
        // invoice still itemises the booking, and the difference stays
        // auditable rather than silently disappearing into one number.
        totalPrice = validated.data.total_price
        priceSnapshot = {
          ...quoteResult.snapshot,
          price_override: true,
          computed_total: quoteResult.total,
          ...(price_override_reason ? { price_override_reason } : {}),
          total: validated.data.total_price,
        }
      } else {
        totalPrice = quoteResult.total
      }
    } else {
      pricingNote = quoteResult.error
    }
  }

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
      extra_trip_ids: extra_trip_ids || [],
      trip_package_ids: trip_package_ids || [],
      total_price: totalPrice ?? null,
      price_snapshot: priceSnapshot,
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

  // Surfaced, not swallowed: the booking saved, but the dashboard should say
  // so when the price could not be computed and the typed total was kept.
  return NextResponse.json(
    { booking: data, ...(pricingNote ? { pricing_warning: pricingNote } : {}) },
    { status: 201 },
  )
}
