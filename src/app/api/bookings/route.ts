import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransferPricing } from '@/lib/data'
import { quotePackage, quoteTransfer, isPackageDepartureDay, isPackageReturnDay } from '@/lib/pricing'

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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const bookingSchema = z.object({
  customer_name: z.string().min(3).max(100),
  customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  accommodation_id: z.string().uuid().optional(),
  governorate: z.string().max(40).optional(),
  trip_date: isoDate.optional(),
  return_date: isoDate.optional(),
  duration: z.union([z.literal(4), z.literal(5)]).optional(),
  nights: z.number().int().min(1).max(30).optional(),
  transfer_type: z.enum(['package_bus', 'hiace']).optional(),
  transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
})

type BookingInput = z.infer<typeof bookingSchema>

/**
 * The price is always recomputed on the server from the dashboard-managed
 * tables. Whatever the browser thinks the price is, is only ever a preview.
 */
async function priceBooking(input: BookingInput): Promise<number | null> {
  const supabase = getSupabaseAdmin()

  if (input.booking_type === 'transfer-only') {
    const pricing = await getTransferPricing()
    return quoteTransfer({
      pricing,
      type: input.transfer_type ?? 'hiace',
      governorateCode: input.governorate,
      direction: input.transfer_direction ?? 'to_dahab',
      numPeople: input.num_people,
    }).total
  }

  if (!input.accommodation_id) return null

  const { data: acc } = await supabase
    .from('accommodations')
    .select('price_per_night, price_4day, price_5day')
    .eq('id', input.accommodation_id)
    .single()

  if (!acc) return null

  if (input.booking_type === 'accommodation-only') {
    return Number(acc.price_per_night) * (input.nights ?? 1) * input.num_people
  }

  // package
  const pricing = await getTransferPricing()
  const accommodationPrice =
    input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)

  return quotePackage({
    pricing,
    accommodationPrice,
    governorateCode: input.governorate,
    direction: input.transfer_direction ?? 'round_trip',
    numPeople: input.num_people,
  }).total
}

/** Package buses only leave Sun/Thu and only come back Mon/Fri. */
function validateDates(input: BookingInput): string | null {
  if (input.booking_type !== 'package') return null
  if (input.trip_date && !isPackageDepartureDay(input.trip_date)) {
    return 'Package departures are only available on Sunday or Thursday'
  }
  if (input.return_date && !isPackageReturnDay(input.return_date)) {
    return 'Package returns are only available on Monday or Friday'
  }
  if (input.trip_date && input.return_date && input.return_date < input.trip_date) {
    return 'Return date cannot be before the departure date'
  }
  return null
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
    const total_price = await priceBooking(validated.data)

    const { customer_email, ...rest } = validated.data

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...rest,
        customer_email: customer_email || null,
        total_price,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    await supabase.from('customers').upsert(
      {
        name: validated.data.customer_name,
        phone: validated.data.customer_phone,
        email: customer_email || null,
      },
      { onConflict: 'phone', ignoreDuplicates: false },
    )

    return NextResponse.json({ success: true, booking: data }, { status: 201 })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
