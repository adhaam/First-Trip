import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransferPricing } from '@/lib/data'
import {
  quotePackage, quoteAccommodationPackage, quoteStay, quoteTransfer,
  nightsForDuration, isPackageDepartureDay, isPackageReturnDay,
} from '@/lib/pricing'
import type { MealPlan } from '@/lib/types'

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
  room_type: z.enum(['double', 'single']).optional(),
  meal_plan_key: z.string().optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
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
    .select('price_per_night, price_4day, price_5day, price_double_room, price_single_room, meal_plans')
    .eq('id', input.accommodation_id)
    .single()

  if (!acc) return null

  const hasRoomPricing = Number(acc.price_double_room) > 0 || Number(acc.price_single_room) > 0
  const mealPlans = (acc.meal_plans || []) as MealPlan[]
  const mealPlanPricePerNight =
    mealPlans.find((m) => m.key === input.meal_plan_key && m.is_active)?.price_per_person_per_night || 0

  if (input.booking_type === 'accommodation-only') {
    if (hasRoomPricing) {
      return quoteStay({
        accommodation: acc,
        roomType: input.room_type ?? 'double',
        mealPlanPricePerNight,
        nights: input.nights ?? 1,
        numPeople: input.num_people,
      }).total
    }
    return Number(acc.price_per_night) * (input.nights ?? 1) * input.num_people
  }

  // package
  const pricing = await getTransferPricing()

  if (hasRoomPricing) {
    // "x" — the trips bundled into every package by default, admin-configured
    // in site settings; their price sums into the total automatically.
    const { data: settings } = await supabase
      .from('site_settings')
      .select('package_included_trip_ids')
      .eq('id', 1)
      .single()
    const includedIds: string[] = settings?.package_included_trip_ids || []

    const tripIds = Array.from(new Set([...includedIds, ...(input.extra_trip_ids || [])]))
    let includedTripsTotal = 0
    let extraTripsTotal = 0
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('sinai_trips')
        .select('id, price')
        .in('id', tripIds)
      const priceById = new Map((trips || []).map((t) => [t.id, Number(t.price) || 0]))
      includedTripsTotal = includedIds.reduce((sum, id) => sum + (priceById.get(id) || 0), 0)
      extraTripsTotal = (input.extra_trip_ids || []).reduce((sum, id) => sum + (priceById.get(id) || 0), 0)
    }

    return quoteAccommodationPackage({
      pricing,
      accommodation: acc,
      roomType: input.room_type ?? 'double',
      mealPlanPricePerNight,
      nights: nightsForDuration(input.duration === 5 ? 5 : 4),
      includedTripsTotal,
      extraTripsTotal,
      transferType: input.transfer_type ?? 'hiace',
      governorateCode: input.governorate,
      direction: input.transfer_direction ?? 'round_trip',
      numPeople: input.num_people,
    }).total
  }

  // legacy fallback — flat price_4day/price_5day, bus transfer only
  const accommodationPrice = input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)
  return quotePackage({
    pricing,
    accommodationPrice,
    governorateCode: input.governorate,
    direction: input.transfer_direction ?? 'round_trip',
    numPeople: input.num_people,
  }).total
}

/**
 * The shared package bus only leaves Sun/Thu and only comes back Mon/Fri.
 * A private Hiace runs any day, so the restriction only applies when the
 * customer picked (or defaulted to) the shared bus.
 */
function validateDates(input: BookingInput): string | null {
  if (input.booking_type !== 'package') return null
  if (input.transfer_type === 'hiace') return null
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
