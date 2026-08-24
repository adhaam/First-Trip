import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { getDateAvailability } from '@/lib/experiences-data'
import { publicBookingSchema } from '@/lib/experiences-schema'

// Same in-memory limiter shape as /api/bookings and /api/trip-bookings.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 60 * 1000

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

/**
 * Admin notification. There is no transactional email provider wired into this
 * project, so this posts to an n8n webhook when one is configured (same pattern
 * as the AI chat integration) and otherwise logs — never blocking the booking.
 */
async function notifyAdmin(payload: Record<string, unknown>): Promise<void> {
  const webhook = process.env.EXPERIENCE_BOOKING_WEBHOOK_URL
  if (!webhook) {
    console.info('[experience-booking] new request (no webhook configured):', payload)
    return
  }
  try {
    await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.WEEMAP_N8N_CHAT_SECRET
          ? { 'X-Weemap-Secret': process.env.WEEMAP_N8N_CHAT_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error('[experience-booking] admin notification failed:', err)
  }
}

/**
 * Public endpoint for a Signature Experience booking *request*. WhatsApp-first:
 * nothing is charged here, the row lands as `pending` and staff confirm it.
 */
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
    const validated = publicBookingSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    }
    const input = validated.data

    const availability = await getDateAvailability(input.experience_date_id)
    if (!availability) {
      return NextResponse.json({ error: 'Trip date not found' }, { status: 404 })
    }
    if (!availability.is_bookable) {
      return NextResponse.json({ error: 'This date is not open for booking' }, { status: 409 })
    }
    if (input.spots_requested > availability.spots_remaining) {
      return NextResponse.json(
        { error: 'Not enough spots left', spots_remaining: availability.spots_remaining },
        { status: 409 },
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: experience } = await supabase
      .from('experiences')
      .select('id, slug, title_ar, title_en, price, currency, status')
      .eq('id', availability.experience_id)
      .maybeSingle()

    if (!experience || experience.status !== 'published') {
      return NextResponse.json({ error: 'Experience not available' }, { status: 404 })
    }

    // Price is always server-derived — the client never sends an amount.
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
        email: input.email,
        spots_requested: input.spots_requested,
        notes: input.notes || '',
        quoted_price: quotedPrice,
        currency: experience.currency || 'EGP',
        status: 'pending',
        source: 'website',
      })
      .select()
      .single()

    if (error) {
      console.error('POST experience_booking error:', error)
      return NextResponse.json({ error: 'Failed to create booking request' }, { status: 500 })
    }

    await recordCustomerActivity(customer.id)
    await notifyAdmin({
      type: 'experience_booking',
      booking_id: data.id,
      experience: experience.title_en || experience.title_ar,
      slug: experience.slug,
      dates: `${availability.start_date} → ${availability.end_date}`,
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      spots_requested: input.spots_requested,
      quoted_price: quotedPrice,
      currency: experience.currency || 'EGP',
      notes: input.notes || '',
    })

    return NextResponse.json(
      {
        success: true,
        booking: { id: data.id, status: data.status },
        spots_remaining: availability.spots_remaining - input.spots_requested,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('Experience booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
