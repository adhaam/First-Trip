import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Customer 360 — one unified profile across every WEEMAP surface, resolved
 * through the canonical customer_id (see src/lib/customer.ts merged_into
 * chain). Confirmed/completed activity is distinguished from open requests
 * so the summary never invents realized revenue from unconfirmed requests.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()

  const { data: requested } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
  if (!requested) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  const canonicalId = requested.merged_into || requested.id
  const { data: canonical } = await supabase.from('customers').select('*').eq('id', canonicalId).single()
  if (!canonical) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  // Every id that resolves to this canonical identity (the canonical row
  // itself + any duplicates chained to it via merged_into).
  const { data: dupes } = await supabase.from('customers').select('id').eq('merged_into', canonicalId)
  const identityIds = [canonicalId, ...(dupes || []).map((d) => d.id)]

  const [
    { data: bookings },
    { data: tripBookings },
    { data: orders },
    { data: experienceBookings },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, booking_type, accommodation_id, accommodations(name_ar, name_en), trip_date, num_people, status, payment_status, total_price, created_at')
      .in('customer_id', identityIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('trip_bookings')
      .select('id, trip_id, sinai_trips(name_ar, name_en), preferred_date, num_people, status, final_price, quoted_price, created_at')
      .in('customer_id', identityIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('commerce_orders')
      .select('id, order_number, order_type, status, fulfillment_method, subtotal, delivery_fee, total_price, created_at, commerce_order_items(id, item_type, name_snapshot_ar, name_snapshot_en, quantity, unit_price, line_total, rental_start_date, rental_end_date, rental_duration_days)')
      .in('customer_id', identityIds)
      .order('created_at', { ascending: false }),
    supabase
      .from('experience_bookings')
      .select('id, experience_id, experiences(title_ar, title_en), is_custom_request, preferred_date, spots_requested, status, quoted_price, currency, created_at')
      .in('customer_id', identityIds)
      .order('created_at', { ascending: false }),
  ])

  const merchOrders = (orders || []).filter((o) => o.order_type === 'merch')
  const rentalOrders = (orders || []).filter((o) => o.order_type === 'rental' || o.order_type === 'mixed')

  const CONFIRMED_BOOKING_STATUSES = new Set(['confirmed', 'completed'])
  const CONFIRMED_ORDER_STATUSES = new Set(['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'])
  const confirmedValue =
    (bookings || []).filter((b) => CONFIRMED_BOOKING_STATUSES.has(b.status)).reduce((s, b) => s + Number(b.total_price || 0), 0) +
    (orders || []).filter((o) => CONFIRMED_ORDER_STATUSES.has(o.status)).reduce((s, o) => s + Number(o.total_price || 0), 0)

  const lastActivityCandidates = [
    canonical.last_activity_at,
    bookings?.[0]?.created_at,
    tripBookings?.[0]?.created_at,
    orders?.[0]?.created_at,
  ].filter(Boolean) as string[]
  const lastActivityAt = lastActivityCandidates.sort().at(-1) || null

  return NextResponse.json({
    customer: canonical,
    mergedDuplicateIds: (dupes || []).map((d) => d.id),
    summary: {
      accommodationBookingsCount: bookings?.length || 0,
      tripBookingsCount: tripBookings?.length || 0,
      merchOrdersCount: merchOrders.length,
      rentalsCount: rentalOrders.length,
      signatureBookingsCount: experienceBookings?.length || 0,
      confirmedValue,
      lastActivityAt,
    },
    accommodationBookings: bookings || [],
    tripBookings: tripBookings || [],
    merchOrders,
    rentalOrders,
    experienceBookings: experienceBookings || [],
  })
}

/**
 * Edit the small set of fields that are safe to hand-correct from the admin
 * panel. `phone`/`normalized_phone`/`whatsapp_phone` are derived/system-
 * managed (see src/lib/phone.ts + booking-time upsert logic) and must never
 * be directly editable here — same for `merged_into`, which is dedup-only
 * plumbing with no UI-level merge safeguards yet.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}

  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    updates.name = name
  }
  if ('email' in body) {
    const email = typeof body.email === 'string' ? body.email.trim() : ''
    updates.email = email || null
  }
  if ('notes' in body) {
    updates.notes = typeof body.notes === 'string' ? body.notes : ''
  }
  if ('preferred_language' in body) {
    if (body.preferred_language !== 'ar' && body.preferred_language !== 'en') {
      return NextResponse.json({ error: 'preferred_language must be "ar" or "en"' }, { status: 400 })
    }
    updates.preferred_language = body.preferred_language
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No editable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    console.error('PATCH customer error:', error)
    return NextResponse.json({ error: 'Failed to update customer' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

  return NextResponse.json({ customer: data })
}
