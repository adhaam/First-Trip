import { NextRequest, NextResponse } from 'next/server'
import { validateBookingDates } from '@/lib/booking-date-validation'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { bookingSchema, buildBookingRow } from '@/lib/public-booking'
import { computeQuote } from '@/lib/quote-service'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransportSchedule } from '@/lib/transport/load'
import { verifyTurnstile } from '@/lib/turnstile'

export { validateBookingDates, type BookingDateValidationResult } from '@/lib/booking-date-validation'

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

  if (entry.count >= RATE_LIMIT) {
    return false
  }

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
    if (body && typeof body === 'object' && 'website' in body && body.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const validated = bookingSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json(
        { error: 'Invalid data', details: validated.error.flatten() },
        { status: 400 },
      )
    }

    if (
      process.env.TURNSTILE_SECRET_KEY &&
      !(await verifyTurnstile(validated.data.turnstile_token ?? null))
    ) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const schedule = await getTransportSchedule()
    const dateValidation = validateBookingDates(validated.data, schedule)
    if (!dateValidation.ok) {
      return NextResponse.json(
        { error: dateValidation.error, code: dateValidation.code },
        { status: 400 },
      )
    }

    const bookingInput = dateValidation.input
    const quote = await computeQuote({ ...bookingInput, start_date: bookingInput.trip_date! })
    if (!quote.ok) {
      return NextResponse.json(
        { error: quote.error, ...(quote.code ? { code: quote.code } : {}) },
        { status: quote.status },
      )
    }

    const customer = await findOrCreateCustomerByPhone({
      phone: bookingInput.customer_phone,
      name: bookingInput.customer_name,
      email: bookingInput.customer_email || null,
    })
    const { data, error } = await getSupabaseAdmin()
      .from('bookings')
      .insert({ ...buildBookingRow(bookingInput, quote), customer_id: customer.id })
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
