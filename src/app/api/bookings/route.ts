import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransferPricing } from '@/lib/data'
import {
  quotePackage, quoteTransfer, quotePackageV2,
  buildPriceSnapshot, buildStaySnapshot, toISODate,
  nightsForDuration, isPackageDepartureDay, isPackageReturnDay,
} from '@/lib/pricing'
import type { TripPriceInput } from '@/lib/pricing'
import type { AccommodationSeasonalRate, MealPlan, PriceSnapshot } from '@/lib/types'

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
  room_type: z.enum(['double', 'single', 'triple']).optional(),
  meal_plan_key: z.string().optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
})

type BookingInput = z.infer<typeof bookingSchema>

interface PricedBooking {
  total: number
  snapshot: PriceSnapshot | null
}

/**
 * The price is ALWAYS recomputed on the server from the dashboard-managed
 * tables — whatever the browser thinks the price is, is only ever a preview.
 * Alongside the total, a frozen breakdown of every rate used is captured into
 * `price_snapshot`, so later price changes never affect this booking.
 */
async function priceBooking(input: BookingInput): Promise<PricedBooking | null> {
  const supabase = getSupabaseAdmin()

  if (input.booking_type === 'transfer-only') {
    const pricing = await getTransferPricing()
    const q = quoteTransfer({
      pricing,
      type: input.transfer_type ?? 'hiace',
      governorateCode: input.governorate,
      direction: input.transfer_direction ?? 'to_dahab',
      numPeople: input.num_people,
    })
    return {
      total: q.total,
      snapshot: {
        transfer_rate_used: q.perPerson,
        transfer_subtotal: q.total,
        num_people: q.numPeople,
        total: q.total,
        computed_at: new Date().toISOString(),
      },
    }
  }

  if (!input.accommodation_id) return null

  const [{ data: acc }, { data: seasonalRows }] = await Promise.all([
    supabase
      .from('accommodations')
      .select('price_per_night, price_4day, price_5day, price_double_room, price_single_room, price_triple_room, meal_plans')
      .eq('id', input.accommodation_id)
      .single(),
    supabase
      .from('accommodation_seasonal_rates')
      .select('*')
      .eq('accommodation_id', input.accommodation_id)
      .eq('is_active', true),
  ])

  if (!acc) return null

  const accWithRates = {
    price_double_room: Number(acc.price_double_room) || 0,
    price_single_room: Number(acc.price_single_room) || 0,
    price_triple_room: Number(acc.price_triple_room) || 0,
    seasonal_rates: (seasonalRows ?? []) as AccommodationSeasonalRate[],
  }

  const hasRoomPricing =
    accWithRates.price_double_room > 0 || accWithRates.price_single_room > 0

  const mealPlans = (acc.meal_plans || []) as MealPlan[]
  const mealPlanPricePerNight =
    mealPlans.find((m) => m.key === input.meal_plan_key && m.is_active)?.price_per_person_per_night || 0

  // Check-in date drives night-by-night seasonal resolution; without one we
  // still price correctly from base rates starting today.
  const checkIn = input.trip_date ?? toISODate(new Date())

  if (input.booking_type === 'accommodation-only') {
    if (hasRoomPricing) {
      const { total, snapshot } = buildStaySnapshot(
        accWithRates,
        input.room_type ?? 'double',
        checkIn,
        input.nights ?? 1,
        mealPlanPricePerNight,
        input.num_people,
        input.meal_plan_key,
      )
      return { total, snapshot }
    }
    // legacy flat per-night fallback
    const total = Number(acc.price_per_night) * (input.nights ?? 1) * input.num_people
    return { total, snapshot: null }
  }

  // ─── package ───
  const pricing = await getTransferPricing()

  if (hasRoomPricing) {
    // The two trips bundled into every package (admin-configured) are charged
    // at their PACKAGE cost; extra trips at their normal public price.
    const { data: settings } = await supabase
      .from('site_settings')
      .select('package_included_trip_ids')
      .eq('id', 1)
      .single()
    const includedIds: string[] = settings?.package_included_trip_ids || []
    const extraIds = (input.extra_trip_ids || []).filter((id) => !includedIds.includes(id))

    const tripIds = Array.from(new Set([...includedIds, ...extraIds]))
    let includedTrips: TripPriceInput[] = []
    let extraTrips: TripPriceInput[] = []
    if (tripIds.length > 0) {
      const { data: trips } = await supabase
        .from('sinai_trips')
        .select('id, name_en, price, package_price')
        .in('id', tripIds)
      const byId = new Map<string, TripPriceInput>(
        (trips || []).map((t) => [
          t.id as string,
          {
            id: t.id as string,
            name_en: t.name_en as string,
            price: Number(t.price) || 0,
            package_price: t.package_price == null ? null : Number(t.package_price),
          },
        ]),
      )
      includedTrips = includedIds.flatMap((id) => byId.get(id) ?? [])
      extraTrips = extraIds.flatMap((id) => byId.get(id) ?? [])
    }

    const quoteInput = {
      pricing,
      accommodation: accWithRates,
      roomType: input.room_type ?? 'double',
      checkIn,
      nights: input.nights ?? nightsForDuration(input.duration === 5 ? 5 : 4),
      mealPlanPricePerNight,
      mealPlanKey: input.meal_plan_key,
      includedTrips,
      extraTrips,
      transferType: input.transfer_type ?? 'package_bus',
      governorateCode: input.governorate,
      direction: input.transfer_direction ?? 'round_trip',
      numPeople: input.num_people,
    }
    const quote = quotePackageV2(quoteInput)
    return { total: quote.total, snapshot: buildPriceSnapshot(quoteInput, quote) }
  }

  // legacy fallback — flat price_4day/price_5day, bus transfer only
  const accommodationPrice = input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)
  const total = quotePackage({
    pricing,
    accommodationPrice,
    governorateCode: input.governorate,
    direction: input.transfer_direction ?? 'round_trip',
    numPeople: input.num_people,
  }).total
  return { total, snapshot: null }
}

/**
 * The shared package bus only leaves Sun/Thu and only comes back Mon/Fri.
 * A private Hiace runs any day, so the restriction only applies when the
 * customer picked (or defaulted to) the shared bus.
 */
function validateDates(input: BookingInput): string | null {
  if (input.trip_date && input.return_date && input.return_date < input.trip_date) {
    return 'Return date cannot be before the departure date'
  }
  const usesBus =
    (input.booking_type === 'package' && input.transfer_type !== 'hiace') ||
    (input.booking_type === 'transfer-only' && input.transfer_type === 'package_bus')
  if (!usesBus) return null
  if (input.trip_date && !isPackageDepartureDay(input.trip_date)) {
    return 'Bus departures are only available on Sunday or Thursday'
  }
  if (input.return_date && !isPackageReturnDay(input.return_date)) {
    return 'Bus returns are only available on Monday or Friday'
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
    const priced = await priceBooking(validated.data)

    const { customer_email, ...rest } = validated.data

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...rest,
        customer_email: customer_email || null,
        total_price: priced?.total ?? null,
        price_snapshot: priced?.snapshot ?? null,
        status: 'new',
        source: 'website',
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
