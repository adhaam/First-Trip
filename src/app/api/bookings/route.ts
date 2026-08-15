import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransferPricing, getAccommodationById } from '@/lib/data'
import {
  quotePackage, quotePackageV2, quoteTransfer,
  buildPriceSnapshot, buildStaySnapshot,
  nightsForDuration, isPackageDepartureDay, isPackageReturnDay,
} from '@/lib/pricing'
import type { TripPriceInput } from '@/lib/pricing'
import type { MealPlan, PriceSnapshot } from '@/lib/types'

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

interface PricingResult {
  total_price: number | null
  price_snapshot: PriceSnapshot | null
}

/**
 * The price is always recomputed on the server from the dashboard-managed
 * tables. Whatever the browser thinks the price is, is only ever a preview.
 * Every priced booking freezes a `price_snapshot` — see lib/pricing.ts — so a
 * later change to hotel/trip/transfer prices can never retroactively change
 * what this customer was quoted.
 */
async function priceBooking(input: BookingInput): Promise<PricingResult> {
  const supabase = getSupabaseAdmin()

  // ─── transfer-only ───
  if (input.booking_type === 'transfer-only') {
    const pricing = await getTransferPricing()
    const transferType = input.transfer_type ?? 'hiace'
    const quote = quoteTransfer({
      pricing,
      type: transferType,
      governorateCode: input.governorate,
      direction: input.transfer_direction ?? 'to_dahab',
      numPeople: input.num_people,
    })
    return {
      total_price: quote.total,
      price_snapshot: {
        transfer_rate_used: quote.perPerson,
        transfer_subtotal: quote.total,
        num_people: quote.numPeople,
        total: quote.total,
        computed_at: new Date().toISOString(),
      },
    }
  }

  if (!input.accommodation_id) return { total_price: null, price_snapshot: null }

  const acc = await getAccommodationById(input.accommodation_id)
  if (!acc) return { total_price: null, price_snapshot: null }

  const hasRoomPricing = Number(acc.price_double_room) > 0 || Number(acc.price_single_room) > 0
  const mealPlans = (acc.meal_plans || []) as MealPlan[]
  const mealPlan = mealPlans.find((m) => m.key === input.meal_plan_key && m.is_active)
  const mealPlanPricePerNight = mealPlan?.price_per_person_per_night || 0

  // ─── accommodation-only (stay-only) ───
  if (input.booking_type === 'accommodation-only') {
    if (hasRoomPricing && input.trip_date) {
      const { total, snapshot } = buildStaySnapshot(
        acc,
        input.room_type ?? 'double',
        input.trip_date,
        input.nights ?? 1,
        mealPlanPricePerNight,
        input.num_people,
        mealPlan?.key,
      )
      return { total_price: total, price_snapshot: snapshot }
    }
    // legacy fallback — no room pricing configured for this property yet
    const total = Number(acc.price_per_night) * (input.nights ?? 1) * input.num_people
    return { total_price: total, price_snapshot: null }
  }

  // ─── package ───
  const pricing = await getTransferPricing()

  if (hasRoomPricing && input.trip_date) {
    // The two trips bundled into every package by default, admin-configured
    // in Website settings; their package cost sums into the total automatically.
    const { data: settings } = await supabase
      .from('site_settings')
      .select('package_included_trip_ids')
      .eq('id', 1)
      .single()
    const includedIds: string[] = settings?.package_included_trip_ids || []
    const extraIds = input.extra_trip_ids || []
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
          t.id,
          { id: t.id, name_en: t.name_en, price: Number(t.price) || 0, package_price: t.package_price },
        ]),
      )
      includedTrips = includedIds.flatMap((id) => byId.get(id) ?? [])
      extraTrips = extraIds.flatMap((id) => byId.get(id) ?? [])
    }

    const transferType = input.transfer_type ?? 'hiace'
    const direction = input.transfer_direction ?? 'round_trip'
    const nights = nightsForDuration(input.duration === 5 ? 5 : 4)
    const roomType = input.room_type ?? 'double'

    const quoteInput = {
      pricing,
      accommodation: acc,
      roomType,
      checkIn: input.trip_date,
      nights,
      numRooms: 1,
      mealPlanPricePerNight,
      mealPlanKey: mealPlan?.key,
      includedTrips,
      extraTrips,
      transferType,
      governorateCode: input.governorate,
      direction,
      numPeople: input.num_people,
    }
    const quote = quotePackageV2(quoteInput)
    const snapshot = buildPriceSnapshot(quoteInput, quote)
    return { total_price: quote.total, price_snapshot: snapshot }
  }

  // legacy fallback — flat price_4day/price_5day, bus transfer only, no room
  // pricing configured yet for this property
  const accommodationPrice = input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)
  const total = quotePackage({
    pricing,
    accommodationPrice,
    governorateCode: input.governorate,
    direction: input.transfer_direction ?? 'round_trip',
    numPeople: input.num_people,
  }).total
  return { total_price: total, price_snapshot: null }
}

/**
 * The shared package bus only leaves Sun/Thu and only comes back Mon/Fri.
 * A private Hiace runs any day, so the restriction only applies when the
 * customer picked (or defaulted to) the shared bus — whether that's inside
 * a package or a standalone transfer-only booking.
 */
function validateDates(input: BookingInput): string | null {
  if (input.booking_type !== 'package' && input.booking_type !== 'transfer-only') return null
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
    const { total_price, price_snapshot } = await priceBooking(validated.data)

    const { customer_email, ...rest } = validated.data

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...rest,
        customer_email: customer_email || null,
        total_price,
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
