import { NextRequest, NextResponse } from 'next/server'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { computeQuote } from '@/lib/quote-service'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyTurnstile } from '@/lib/turnstile'
import { isPackageDepartureDay, isPackageReturnDay } from '@/lib/pricing'
import { bookingSchema, buildBookingRow, type BookingInput } from '@/lib/public-booking'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 60 * 1000

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) { rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW }); return true }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

function validateDates(input: BookingInput): string | null {
  if (input.booking_type !== 'package' && input.booking_type !== 'transfer-only') return null
  if (input.transfer_type === 'hiace') return null
  const fromDahab = input.booking_type === 'transfer-only' && input.transfer_direction === 'from_dahab'
  if (input.trip_date && fromDahab && !isPackageReturnDay(input.trip_date)) return 'Shared bus returns are only available on Monday or Friday'
  if (input.trip_date && !fromDahab && !isPackageDepartureDay(input.trip_date)) return 'Package departures are only available on Sunday or Thursday'
  if (input.return_date && !isPackageReturnDay(input.return_date)) return 'Package returns are only available on Monday or Friday'
  if (input.trip_date && input.return_date && input.return_date < input.trip_date) return 'Return date cannot be before the departure date'
  return null
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const body = await req.json().catch(() => null)
    if (body && typeof body === 'object' && 'website' in body && body.website) return NextResponse.json({ success: true }, { status: 201 })
    const validated = bookingSchema.safeParse(body)
    if (!validated.success) return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    if (process.env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(validated.data.turnstile_token ?? null))) return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    const dateError = validateDates(validated.data)
    if (dateError) return NextResponse.json({ error: dateError }, { status: 400 })
    const quote = await computeQuote({ ...validated.data, start_date: validated.data.trip_date! })
    if (!quote.ok) return NextResponse.json({ error: quote.error, ...(quote.code ? { code: quote.code } : {}) }, { status: quote.status })
    const customer = await findOrCreateCustomerByPhone({ phone: validated.data.customer_phone, name: validated.data.customer_name, email: validated.data.customer_email || null })
    const { data, error } = await getSupabaseAdmin().from('bookings').insert({ ...buildBookingRow(validated.data, quote), customer_id: customer.id }).select().single()
    if (error) { console.error('Supabase error:', error); return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 }) }
    await recordCustomerActivity(customer.id)
    return NextResponse.json({ success: true, booking: data }, { status: 201 })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
