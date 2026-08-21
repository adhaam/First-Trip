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
      confirmedValue,
      lastActivityAt,
    },
    accommodationBookings: bookings || [],
    tripBookings: tripBookings || [],
    merchOrders,
    rentalOrders,
  })
}
