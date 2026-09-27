import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { buildTripPriceSnapshot, effectiveTripPrice } from '@/lib/pricing'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import {
  adminTripBookingSchema,
  bookingCustomerInput,
  buildAdminTripBookingRow,
} from '@/lib/admin-booking-rows'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  let query = supabase
    .from('trip_bookings')
    .select('*, sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)')
    .order('created_at', { ascending: false })
    .limit(300)
  // Journey components (converted off a trip_request, migration 049) are worked from the journey's
  // own detail screen, not this list — they'd otherwise show up twice with no separate action.
  if (req.nextUrl.searchParams.get('include_components') !== 'true') {
    query = query.is('trip_request_id', null)
  }
  const { data, error } = await query
  if (error) {
    console.error('GET trip_bookings error:', error)
    return NextResponse.json({ error: 'Failed to load trip bookings' }, { status: 500 })
  }
  return NextResponse.json({ tripBookings: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const parsed = adminTripBookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', details: parsed.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)

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

  const snapshot = buildTripPriceSnapshot(effectiveTripPrice(trip), parsed.data.num_people)

  // Link to the canonical customer (same resolver as the public trip-booking
  // route) — this path previously stored no customer_id at all, so staff-
  // created trip bookings never appeared on the Customer 360 page.
  let customerId: string
  try {
    customerId = (await findOrCreateCustomerByPhone(bookingCustomerInput(parsed.data))).id
  } catch (err) {
    console.error('POST trip_booking customer resolution error:', err)
    return NextResponse.json({ error: 'Failed to resolve customer' }, { status: 500 })
  }

  // source is a validated STAFF_BOOKING_SOURCES value (default 'manual') —
  // the old hardcoded 'admin' violated trip_bookings_source_check and made
  // every staff-created trip booking fail.
  const { data, error } = await supabase
    .from('trip_bookings')
    .insert(buildAdminTripBookingRow(parsed.data, snapshot, customerId))
    .select('*, sinai_trips(name_ar, name_en)')
    .single()
  if (error) {
    console.error('POST trip_booking error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  // Saved already — a failed counter bump must not become an error response.
  try {
    await recordCustomerActivity(customerId)
  } catch (err) {
    console.error('POST trip_booking recordCustomerActivity error:', err)
  }
  return NextResponse.json({ tripBooking: data }, { status: 201 })
}
