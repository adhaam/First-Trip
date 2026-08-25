import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { bookingSchema, priceBooking, validateDates } from '@/lib/booking-pricing'

// Rate limiting (simple in-memory store — for production use Upstash Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5 // max 5 bookings
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)
    const validated = bookingSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validated.error.flatten() },
        { status: 400 },
      )
    }

    const dateError = validateDates(validated.data)
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { total_price, price_snapshot } = await priceBooking(validated.data)

    // Resolve the canonical customer BEFORE creating the booking so it can
    // be linked via customer_id from the start (unified customer identity —
    // phone is the matching key, the UUID is the relational FK).
    const customer = await findOrCreateCustomerByPhone({
      phone: validated.data.customer_phone,
      name: validated.data.customer_name,
      email: validated.data.customer_email || null,
    })

    // Strip fields that don't exist as top-level booking columns
    // (upgrade_id and room_allocations go into price_snapshot only)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customer_email, room_allocations: _allocs, upgrade_id: _upgradeId, ...rest } = validated.data

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...rest,
        customer_id: customer.id,
        customer_email: customer_email || null,
        total_price,
        // price_snapshot already contains room_allocations (with upgrade details) from priceBooking
        price_snapshot,
        status: 'new',
        payment_status: 'unpaid',
        amount_paid: 0,
        source: 'website',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    await recordCustomerActivity(customer.id)

    return NextResponse.json({ success: true, booking: data }, { status: 201 })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
