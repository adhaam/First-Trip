import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { computeQuote } from '@/lib/quote-service'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import {
  bookingCustomerInput,
  buildManualBookingRow,
  manualBookingSchema,
  resolveManualBookingPricing,
} from '@/lib/admin-booking-rows'

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
// booking regardless of where it came from. Admin-only, no rate limit.
// Validation + row building live in lib/admin-booking-rows.ts (unit tested).
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
  const { accommodation_id, governorate, trip_date, meal_plan_key, extra_trip_ids, trip_package_ids } = input

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
  const quote = trip_date
    ? await computeQuote({
        booking_type: input.booking_type,
        accommodation_id: accommodation_id || undefined,
        duration: input.duration,
        nights: input.nights,
        start_date: trip_date,
        transfer_type: input.transfer_type,
        transfer_direction: input.transfer_direction,
        governorate: governorate || undefined,
        room_type: input.room_type,
        meal_plan_key: meal_plan_key || undefined,
        extra_trip_ids,
        trip_package_ids,
        num_people: input.num_people,
      })
    : null
  const pricing = resolveManualBookingPricing(input, quote)

  // ─── Canonical customer ───
  //
  // Same resolver as the public booking route: matches on normalized phone,
  // only fills blank name/email on an existing customer (never overwrites
  // what is already on file), and links the booking via customer_id so it
  // shows up on the Customer 360 page.
  let customerId: string
  try {
    customerId = (await findOrCreateCustomerByPhone(bookingCustomerInput(input))).id
  } catch (err) {
    console.error('POST manual booking customer resolution error:', err)
    return NextResponse.json({ error: 'Failed to resolve customer' }, { status: 500 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('bookings')
    .insert(buildManualBookingRow(input, pricing, customerId))
    .select('*, accommodations(name_ar, name_en)')
    .single()

  if (error) {
    console.error('POST manual booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // The booking is saved; a failed counter bump must not turn that into an
  // error response (the dashboard would retry and create a duplicate).
  try {
    await recordCustomerActivity(customerId)
  } catch (err) {
    console.error('POST manual booking recordCustomerActivity error:', err)
  }

  // Surfaced, not swallowed: the booking saved, but the dashboard should say
  // so when the price could not be computed and the typed total was kept.
  return NextResponse.json(
    { booking: data, ...(pricing.pricingNote ? { pricing_warning: pricing.pricingNote } : {}) },
    { status: 201 },
  )
}
