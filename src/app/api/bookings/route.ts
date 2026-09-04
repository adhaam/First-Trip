import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { getTransferPricing, getAccommodationById } from '@/lib/data'
import { verifyTurnstile } from '@/lib/turnstile'
import {
  quotePackage, quotePackageV2, quoteTransfer,
  buildPriceSnapshot, buildStaySnapshot,
  nightsForDuration, isPackageDepartureDay, isPackageReturnDay, roomsForPeople,
  baseNightlyRoomRate, upgradeSubtotal,
  includedTripCost, extraTripCost, validateAndPriceTripPackages,
} from '@/lib/pricing'
import type { TripPriceInput } from '@/lib/pricing'
import type { MealPlan, PriceSnapshot, RoomUpgrade } from '@/lib/types'
import { getTripPackagesForPricing } from '@/lib/trip-packages'

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
  // Optional upgrade ID — server validates and derives extra_price_per_night.
  // Clients MUST NOT send extra_price_per_night; it is ignored if present.
  upgrade_id: z.string().uuid().optional(),
  // Optional multi-room allocation (e.g. 1 double + 1 single for 3 people)
  room_allocations: z.array(z.object({
    type: z.enum(['single', 'double', 'triple']),
    count: z.number().int().min(1).max(20),
    // Per-allocation upgrade — server validates, client only sends the ID
    upgrade_id: z.string().uuid().optional(),
  })).optional(),
  meal_plan_key: z.string().optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  trip_package_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
  // Honeypot — real users never see/fill this field. Optional so old
  // clients without it still validate.
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
}).superRefine((value, ctx) => {
  const required = (path: keyof typeof value, message: string) => {
    if (!value[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message })
  }
  if (value.booking_type === 'package') {
    required('accommodation_id', 'Accommodation is required')
    required('governorate', 'Governorate is required')
    required('trip_date', 'Departure date is required')
    required('transfer_type', 'Transport mode is required')
  }
  if (value.booking_type === 'accommodation-only') {
    required('accommodation_id', 'Accommodation is required')
    required('trip_date', 'Check-in date is required')
  }
  if (value.booking_type === 'transfer-only') {
    required('governorate', 'Governorate is required')
    required('trip_date', 'Transfer date is required')
    required('transfer_type', 'Transport mode is required')
  }
})

type BookingInput = z.infer<typeof bookingSchema>

interface PricingResult {
  total_price: number | null
  price_snapshot: PriceSnapshot | null
  /** Set when server-side validation (e.g. Trip Package overlap) rejects the request. */
  error?: string
}

/**
 * Resolve a room upgrade from the accommodation's server-fetched upgrade list.
 * Returns null when:
 *   - No upgrade_id was provided (fine — no upgrade selected)
 *   - The ID doesn't exist in the DB (fake ID from client — silently ignored)
 *   - The upgrade belongs to a different accommodation (cross-hotel inject — rejected)
 *   - The upgrade is inactive (rejected)
 * Only returns the DB-trusted RoomUpgrade record — extra_price_per_night is
 * NEVER taken from client input.
 */
function resolveUpgrade(
  upgradeId: string | undefined,
  accommodationId: string,
  upgrades: RoomUpgrade[],
): RoomUpgrade | null {
  if (!upgradeId) return null
  const found = upgrades.find(
    (u) => u.id === upgradeId && u.accommodation_id === accommodationId && u.is_active,
  )
  return found ?? null
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

  // Upgrades — fetched alongside acc by getAccommodationById (migration-safe: [] if table missing)
  const accUpgrades: RoomUpgrade[] = acc.room_upgrades ?? []

  // ─── accommodation-only (stay-only) ───
  if (input.booking_type === 'accommodation-only') {
    if (hasRoomPricing && input.trip_date) {
      // Multi-room allocation: sum each room group's cost, with per-allocation upgrades
      if (input.room_allocations && input.room_allocations.length > 0) {
        const nights = input.nights ?? 1
        let roomTotal = 0
        const snapshotAllocations: import('@/lib/types').RoomAllocationSnapshot[] = []
        for (const alloc of input.room_allocations) {
          const baseRate = baseNightlyRoomRate(acc, alloc.type)
          const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id!, accUpgrades)
          const extra = upgrade ? upgrade.extra_price_per_night : 0
          const finalRate = baseRate + extra
          roomTotal += finalRate * alloc.count * nights
          snapshotAllocations.push({
            room_type: alloc.type,
            quantity: alloc.count,
            base_nightly_rate: baseRate,
            ...(upgrade ? {
              upgrade_id: upgrade.id,
              upgrade_name: upgrade.name_en,
              upgrade_extra_per_night: upgrade.extra_price_per_night,
            } : {}),
            final_nightly_rate: finalRate,
          })
        }
        const mealTotal = mealPlanPricePerNight * input.num_people * nights
        const total = roomTotal + mealTotal
        return {
          total_price: total,
          price_snapshot: {
            room_allocations: snapshotAllocations,
            nights,
            meal_plan_key: mealPlan?.key,
            meal_plan_price_per_person_per_night: mealPlanPricePerNight,
            meal_subtotal: mealTotal,
            accommodation_subtotal: roomTotal,
            num_people: input.num_people,
            total,
            computed_at: new Date().toISOString(),
          } as unknown as PriceSnapshot,
        }
      }
      // Single room type — apply upgrade to all rooms if selected
      const roomType = input.room_type ?? 'double'
      const upgrade = resolveUpgrade(input.upgrade_id, input.accommodation_id!, accUpgrades)
      const upgradeExtra = upgrade ? upgrade.extra_price_per_night : 0
      const nights = input.nights ?? 1
      const numRooms = roomsForPeople(roomType, input.num_people)
      const { total: baseTotal, snapshot } = buildStaySnapshot(
        acc, roomType, input.trip_date, nights, mealPlanPricePerNight, input.num_people, mealPlan?.key, numRooms,
      )
      const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
      const total = baseTotal + upgradeTotal
      return {
        total_price: total,
        price_snapshot: {
          ...snapshot,
          total,
          ...(upgrade ? {
            room_allocations: [{
              room_type: roomType,
              quantity: numRooms,
              base_nightly_rate: baseNightlyRoomRate(acc, roomType),
              upgrade_id: upgrade.id,
              upgrade_name: upgrade.name_en,
              upgrade_extra_per_night: upgrade.extra_price_per_night,
              final_nightly_rate: baseNightlyRoomRate(acc, roomType) + upgrade.extra_price_per_night,
            }],
          } : {}),
        } as PriceSnapshot,
      }
    }
    // legacy fallback — no room pricing configured for this property yet
    const total = Number(acc.price_per_night) * (input.nights ?? 1) * input.num_people
    return { total_price: total, price_snapshot: null }
  }

  // ─── package ───
  const pricing = await getTransferPricing()

  if (hasRoomPricing && input.trip_date) {
    // The 2 free Sinai trips are a fixed marketing benefit shown alongside
    // every package booking — not tied to specific trip records, so no
    // "included trips" are ever fetched or priced here.
    const extraIds = Array.from(new Set(input.extra_trip_ids || []))

    const includedTrips: TripPriceInput[] = []
    let extraTrips: TripPriceInput[] = []
    if (extraIds.length > 0) {
      const { data: trips } = await supabase
        .from('sinai_trips')
        .select('id, name_en, price, discount_type, discount_value, discount_starts_at, discount_ends_at')
        .in('id', extraIds)
      // Discount fields ride along so extraTripCost() can apply an active
      // discount, and buildPriceSnapshot() freezes the result.
      extraTrips = (trips || []).map((t) => ({
        id: t.id,
        name_en: t.name_en,
        price: Number(t.price) || 0,
        discount_type: t.discount_type,
        discount_value: t.discount_value,
        discount_starts_at: t.discount_starts_at,
        discount_ends_at: t.discount_ends_at,
      }))
    }

    // Trip Packages — server-side authoritative pricing + duplicate protection.
    // Never trust the client's selection or totals.
    const packageIds = Array.from(new Set(input.trip_package_ids || []))
    const selectedPackages = await getTripPackagesForPricing(packageIds)
    if (selectedPackages.length !== packageIds.length) {
      return { total_price: null, price_snapshot: null, error: 'One or more selected Trip Packages are unavailable.' }
    }
    const { subtotal: packagesSubtotal, error: packagesError } = validateAndPriceTripPackages(selectedPackages, extraIds)
    if (packagesError) {
      return { total_price: null, price_snapshot: null, error: packagesError }
    }

    const transferType = input.transfer_type ?? 'hiace'
    const direction = input.transfer_direction ?? 'round_trip'
    const nights = nightsForDuration(input.duration === 5 ? 5 : 4)

    // If room_allocations provided, compute mixed-room pricing with per-allocation upgrades
    if (input.room_allocations && input.room_allocations.length > 0) {
      let roomTotal = 0
      const snapshotAllocations: import('@/lib/types').RoomAllocationSnapshot[] = []
      for (const alloc of input.room_allocations) {
        const baseRate = baseNightlyRoomRate(acc, alloc.type)
        const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id!, accUpgrades)
        const extra = upgrade ? upgrade.extra_price_per_night : 0
        const finalRate = baseRate + extra
        roomTotal += finalRate * alloc.count * nights
        snapshotAllocations.push({
          room_type: alloc.type,
          quantity: alloc.count,
          base_nightly_rate: baseRate,
          ...(upgrade ? {
            upgrade_id: upgrade.id,
            upgrade_name: upgrade.name_en,
            upgrade_extra_per_night: upgrade.extra_price_per_night,
          } : {}),
          final_nightly_rate: finalRate,
        })
      }
      const mealTotal = mealPlanPricePerNight * input.num_people * nights
      const transferQuote = quoteTransfer({
        pricing, type: transferType, governorateCode: input.governorate, direction, numPeople: input.num_people,
      })
      let tripsTotal = 0
      for (const t of includedTrips) tripsTotal += includedTripCost(t) * input.num_people
      for (const t of extraTrips) tripsTotal += extraTripCost(t) * input.num_people
      const packagesTotal = packagesSubtotal * input.num_people
      const total = roomTotal + mealTotal + transferQuote.total + tripsTotal + packagesTotal
      return {
        total_price: total,
        price_snapshot: {
          room_allocations: snapshotAllocations,
          nights,
          meal_plan_key: mealPlan?.key,
          meal_plan_price_per_person_per_night: mealPlanPricePerNight,
          meal_subtotal: mealTotal,
          accommodation_subtotal: roomTotal,
          transfer_rate_used: transferQuote.perPerson,
          transfer_subtotal: transferQuote.total,
          included_trips: includedTrips.map((t) => ({ trip_id: t.id, name_en: t.name_en, package_cost: includedTripCost(t) })),
          extra_trips: extraTrips.map((t) => ({ trip_id: t.id, name_en: t.name_en, price: extraTripCost(t) })),
          trip_packages: selectedPackages.map((p) => ({
            package_id: p.id,
            name_en: p.name_en,
            trip_names_en: (p.trips || []).map((t) => t.name_en),
            total: (p.totals?.packageTotal ?? 0) * input.num_people,
          })),
          trip_packages_subtotal: packagesTotal,
          num_people: input.num_people,
          total,
          computed_at: new Date().toISOString(),
        } as unknown as PriceSnapshot,
      }
    }

    const roomType = input.room_type ?? 'double'
    const numRooms = roomsForPeople(roomType, input.num_people)
    const upgrade = resolveUpgrade(input.upgrade_id, input.accommodation_id!, accUpgrades)
    const upgradeExtra = upgrade ? upgrade.extra_price_per_night : 0

    const quoteInput = {
      pricing,
      accommodation: acc,
      roomType,
      checkIn: input.trip_date,
      nights,
      numRooms,
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
    const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
    const packagesTotal = packagesSubtotal * input.num_people
    const totalWithUpgrade = quote.total + upgradeTotal + packagesTotal
    const baseSnapshot = buildPriceSnapshot(quoteInput, quote)
    const snapshot: PriceSnapshot = {
      ...baseSnapshot,
      total: totalWithUpgrade,
      trip_packages: selectedPackages.map((p) => ({
        package_id: p.id,
        name_en: p.name_en,
        trip_names_en: (p.trips || []).map((t) => t.name_en),
        total: (p.totals?.packageTotal ?? 0) * input.num_people,
      })),
      trip_packages_subtotal: packagesTotal,
      ...(upgrade ? {
        room_allocations: [{
          room_type: roomType,
          quantity: numRooms,
          base_nightly_rate: baseNightlyRoomRate(acc, roomType),
          upgrade_id: upgrade.id,
          upgrade_name: upgrade.name_en,
          upgrade_extra_per_night: upgrade.extra_price_per_night,
          final_nightly_rate: baseNightlyRoomRate(acc, roomType) + upgrade.extra_price_per_night,
        }],
      } : {}),
    }
    return { total_price: totalWithUpgrade, price_snapshot: snapshot }
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
  const startsFromDahab =
    input.booking_type === 'transfer-only' && input.transfer_direction === 'from_dahab'
  if (input.trip_date && startsFromDahab && !isPackageReturnDay(input.trip_date)) {
    return 'Shared bus returns are only available on Monday or Friday'
  }
  if (input.trip_date && !startsFromDahab && !isPackageDepartureDay(input.trip_date)) {
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

    // Honeypot check — pretend success without writing anything, so bots
    // don't learn the mechanism failed.
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

    if (process.env.TURNSTILE_SECRET_KEY) {
      const humanVerified = await verifyTurnstile(validated.data.turnstile_token ?? null)
      if (!humanVerified) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }
    }

    const dateError = validateDates(validated.data)
    if (dateError) {
      return NextResponse.json({ error: dateError }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    const { total_price, price_snapshot, error: pricingError } = await priceBooking(validated.data)
    if (pricingError) {
      return NextResponse.json({ error: pricingError }, { status: 400 })
    }

    // Resolve the canonical customer BEFORE creating the booking so it can
    // be linked via customer_id from the start (unified customer identity —
    // phone is the matching key, the UUID is the relational FK).
    const customer = await findOrCreateCustomerByPhone({
      phone: validated.data.customer_phone,
      name: validated.data.customer_name,
      email: validated.data.customer_email || null,
    })

    // Strip fields that don't exist as top-level booking columns
    // (upgrade_id/room_allocations go into price_snapshot only; website and
    // turnstile_token are anti-bot fields, never persisted).
    /* eslint-disable @typescript-eslint/no-unused-vars */
    const {
      customer_email, room_allocations: _allocs, upgrade_id: _upgradeId,
      website: _website, turnstile_token: _turnstileToken, ...rest
    } = validated.data
    /* eslint-enable @typescript-eslint/no-unused-vars */

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
