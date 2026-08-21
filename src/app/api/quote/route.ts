import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getTransferPricing, getAccommodationById } from '@/lib/data'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  quotePackageV2,
  quoteTransfer,
  upgradeSubtotal,
  nightsForDuration,
  baseNightlyRoomRate,
  accommodationSubtotal,
  resolveNightlyRates,
  roomsForPeople,
} from '@/lib/pricing'
import type { MealPlan, RoomUpgrade } from '@/lib/types'
import type { TripPriceInput } from '@/lib/pricing'

// ─── calculate_package_quote ──────────────────────────────────────────────────
//
// Narrow server-side quote endpoint. Returns a fully-computed price breakdown
// WITHOUT creating a booking or touching any mutable state.
//
// Designed for:
//   - Ask WEEMAP AI chat (n8n will wire this in a later pass)
//   - Any other server-to-server price query
//
// Security contract (same as /api/bookings):
//   - Server fetches all prices from DB — client prices are IGNORED
//   - upgrade_id is validated against the accommodation's upgrade list
//   - Fake client supplements have zero effect
//   - Internal pricing config (DB rows) is never returned
//
// ─────────────────────────────────────────────────────────────────────────────

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

const quoteSchema = z.object({
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),

  // Accommodation (required for package and accommodation-only)
  accommodation_id: z.string().uuid().optional(),

  // Package-specific
  duration: z.union([z.literal(4), z.literal(5)]).optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),

  // Accommodation-only
  nights: z.number().int().min(1).max(30).optional(),

  // Shared dates
  start_date: isoDate,

  // Transfer
  transfer_type: z.enum(['package_bus', 'hiace']).optional(),
  transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  governorate: z.string().max(40).optional(),

  // Room (single room type OR multi-allocation)
  room_type: z.enum(['double', 'single', 'triple']).optional(),
  upgrade_id: z.string().uuid().optional(),
  room_allocations: z.array(z.object({
    type: z.enum(['single', 'double', 'triple']),
    count: z.number().int().min(1).max(20),
    upgrade_id: z.string().uuid().optional(),
  })).optional(),

  // Meal plan
  meal_plan_key: z.string().optional(),

  // Party size
  num_people: z.number().int().min(1).max(50),
})

type QuoteInput = z.infer<typeof quoteSchema>

function resolveUpgrade(
  upgradeId: string | undefined,
  accommodationId: string,
  upgrades: RoomUpgrade[],
): RoomUpgrade | null {
  if (!upgradeId) return null
  return upgrades.find(
    (u) => u.id === upgradeId && u.accommodation_id === accommodationId && u.is_active,
  ) ?? null
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const validated = quoteSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  const input: QuoteInput = validated.data

  try {
    // ─── transfer-only ───
    if (input.booking_type === 'transfer-only') {
      const pricing = await getTransferPricing()
      const quote = quoteTransfer({
        pricing,
        type: input.transfer_type ?? 'hiace',
        governorateCode: input.governorate,
        direction: input.transfer_direction ?? 'to_dahab',
        numPeople: input.num_people,
      })
      return NextResponse.json({
        booking_type: 'transfer-only',
        transfer_type: input.transfer_type ?? 'hiace',
        direction: input.transfer_direction ?? 'to_dahab',
        per_person: quote.perPerson,
        num_people: quote.numPeople,
        total: quote.total,
        is_priced: quote.isPriced,
        computed_at: new Date().toISOString(),
      })
    }

    if (!input.accommodation_id) {
      return NextResponse.json({ error: 'accommodation_id required' }, { status: 400 })
    }

    const acc = await getAccommodationById(input.accommodation_id)
    if (!acc) {
      return NextResponse.json({ error: 'Accommodation not found' }, { status: 404 })
    }

    const hasRoomPricing = Number(acc.price_double_room) > 0 || Number(acc.price_single_room) > 0
    const mealPlans = (acc.meal_plans || []) as MealPlan[]
    const mealPlan = mealPlans.find((m) => m.key === input.meal_plan_key && m.is_active)
    const mealPlanPricePerNight = mealPlan?.price_per_person_per_night ?? 0
    const accUpgrades: RoomUpgrade[] = acc.room_upgrades ?? []

    // ─── accommodation-only ───
    if (input.booking_type === 'accommodation-only') {
      const nights = input.nights ?? 1

      if (hasRoomPricing) {
        if (input.room_allocations && input.room_allocations.length > 0) {
          // Multi-room allocation
          let roomTotal = 0
          const allocBreakdown = []
          for (const alloc of input.room_allocations) {
            const baseRate = baseNightlyRoomRate(acc, alloc.type)
            const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id, accUpgrades)
            const extra = upgrade ? upgrade.extra_price_per_night : 0
            const finalRate = baseRate + extra
            roomTotal += finalRate * alloc.count * nights
            allocBreakdown.push({
              room_type: alloc.type,
              quantity: alloc.count,
              base_nightly_rate: baseRate,
              upgrade_name: upgrade?.name_en ?? null,
              upgrade_extra_per_night: extra,
              final_nightly_rate: finalRate,
              subtotal: finalRate * alloc.count * nights,
            })
          }
          const mealTotal = mealPlanPricePerNight * input.num_people * nights
          const total = roomTotal + mealTotal
          return NextResponse.json({
            booking_type: 'accommodation-only',
            accommodation_name: acc.name_en,
            nights,
            room_allocations: allocBreakdown,
            meal_plan: mealPlan ? { key: mealPlan.key, label: mealPlan.label_en, price_per_person_per_night: mealPlanPricePerNight } : null,
            meal_subtotal: mealTotal,
            accommodation_subtotal: roomTotal,
            num_people: input.num_people,
            per_person: total / input.num_people,
            total,
            computed_at: new Date().toISOString(),
          })
        }

        // Single room type
        const roomType = input.room_type ?? 'double'
        const numRooms = roomsForPeople(roomType, input.num_people)
        const upgrade = resolveUpgrade(input.upgrade_id, input.accommodation_id, accUpgrades)
        const upgradeExtra = upgrade ? upgrade.extra_price_per_night : 0
        const nightly = resolveNightlyRates(acc, roomType, input.start_date, nights)
        const accSubtotal = accommodationSubtotal(nightly, numRooms)
        const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
        const mealTotal = mealPlanPricePerNight * input.num_people * nights
        const total = accSubtotal + upgradeTotal + mealTotal
        return NextResponse.json({
          booking_type: 'accommodation-only',
          accommodation_name: acc.name_en,
          room_type: roomType,
          num_rooms: numRooms,
          nights,
          nightly_rates: nightly.map((n) => ({ date: n.date, rate: n.rate, source: n.source })),
          accommodation_subtotal: accSubtotal,
          upgrade: upgrade ? { name: upgrade.name_en, extra_per_night: upgrade.extra_price_per_night } : null,
          upgrade_subtotal: upgradeTotal,
          meal_plan: mealPlan ? { key: mealPlan.key, label: mealPlan.label_en, price_per_person_per_night: mealPlanPricePerNight } : null,
          meal_subtotal: mealTotal,
          num_people: input.num_people,
          per_person: total / input.num_people,
          total,
          computed_at: new Date().toISOString(),
        })
      }

      // Legacy fallback
      const legacyTotal = Number(acc.price_per_night) * nights * input.num_people
      return NextResponse.json({
        booking_type: 'accommodation-only',
        accommodation_name: acc.name_en,
        nights,
        num_people: input.num_people,
        per_person: Number(acc.price_per_night),
        total: legacyTotal,
        computed_at: new Date().toISOString(),
      })
    }

    // ─── package ───
    const [pricing] = await Promise.all([getTransferPricing()])

    const supabase = getSupabaseAdmin()
    const { data: settings } = await supabase
      .from('site_settings')
      .select('package_included_trip_ids')
      .eq('id', 1)
      .single()
    const includedIds: string[] = Array.from(new Set(settings?.package_included_trip_ids || []))
    const extraIds = Array.from(new Set(input.extra_trip_ids || []))
      .filter((id) => !includedIds.includes(id))
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

    if (!hasRoomPricing) {
      // Legacy flat price fallback
      const accommodationPrice = input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)
      const transferQuote = quoteTransfer({ pricing, type: 'package_bus', governorateCode: input.governorate, direction, numPeople: input.num_people })
      const total = (accommodationPrice + transferQuote.perPerson) * input.num_people
      return NextResponse.json({
        booking_type: 'package',
        accommodation_name: acc.name_en,
        duration: input.duration ?? 4,
        nights,
        per_person: total / input.num_people,
        num_people: input.num_people,
        total,
        computed_at: new Date().toISOString(),
      })
    }

    // Multi-room allocation path
    if (input.room_allocations && input.room_allocations.length > 0) {
      let roomTotal = 0
      const allocBreakdown = []
      for (const alloc of input.room_allocations) {
        const baseRate = baseNightlyRoomRate(acc, alloc.type)
        const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id, accUpgrades)
        const extra = upgrade ? upgrade.extra_price_per_night : 0
        const finalRate = baseRate + extra
        roomTotal += finalRate * alloc.count * nights
        allocBreakdown.push({
          room_type: alloc.type,
          quantity: alloc.count,
          base_nightly_rate: baseRate,
          upgrade_name: upgrade?.name_en ?? null,
          upgrade_extra_per_night: extra,
          final_nightly_rate: finalRate,
          subtotal: finalRate * alloc.count * nights,
        })
      }
      const mealTotal = mealPlanPricePerNight * input.num_people * nights
      const transferQuote = quoteTransfer({ pricing, type: transferType, governorateCode: input.governorate, direction, numPeople: input.num_people })
      let tripsTotal = 0
      for (const t of includedTrips) tripsTotal += (t.package_price ?? t.price) * input.num_people
      for (const t of extraTrips) tripsTotal += t.price * input.num_people
      const total = roomTotal + mealTotal + transferQuote.total + tripsTotal
      return NextResponse.json({
        booking_type: 'package',
        accommodation_name: acc.name_en,
        duration: input.duration ?? 4,
        nights,
        room_allocations: allocBreakdown,
        accommodation_subtotal: roomTotal,
        transfer_type: transferType,
        transfer_subtotal: transferQuote.total,
        meal_plan: mealPlan ? { key: mealPlan.key, label: mealPlan.label_en, price_per_person_per_night: mealPlanPricePerNight } : null,
        meal_subtotal: mealTotal,
        included_trips: includedTrips.map((t) => ({ name: t.name_en, cost: t.package_price ?? t.price })),
        extra_trips: extraTrips.map((t) => ({ name: t.name_en, cost: t.price })),
        trips_subtotal: tripsTotal,
        num_people: input.num_people,
        per_person: total / input.num_people,
        total,
        computed_at: new Date().toISOString(),
      })
    }

    // Single room type path
    const roomType = input.room_type ?? 'double'
    const numRooms = roomsForPeople(roomType, input.num_people)
    const upgrade = resolveUpgrade(input.upgrade_id, input.accommodation_id, accUpgrades)
    const upgradeExtra = upgrade ? upgrade.extra_price_per_night : 0

    const quote = quotePackageV2({
      pricing,
      accommodation: acc,
      roomType,
      checkIn: input.start_date,
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
    })
    const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
    const total = quote.total + upgradeTotal

    return NextResponse.json({
      booking_type: 'package',
      accommodation_name: acc.name_en,
      duration: input.duration ?? 4,
      nights: quote.nights,
      room_type: roomType,
      num_rooms: quote.numRooms,
      accommodation_subtotal: quote.accommodationSubtotal,
      transfer_type: transferType,
      transfer_subtotal: quote.transferSubtotal,
      upgrade: upgrade ? { name: upgrade.name_en, extra_per_night: upgrade.extra_price_per_night } : null,
      upgrade_subtotal: upgradeTotal,
      meal_plan: mealPlan ? { key: mealPlan.key, label: mealPlan.label_en, price_per_person_per_night: mealPlanPricePerNight } : null,
      meal_subtotal: quote.mealSubtotal,
      included_trips: includedTrips.map((t) => ({ name: t.name_en, cost: t.package_price ?? t.price })),
      extra_trips: extraTrips.map((t) => ({ name: t.name_en, cost: t.price })),
      included_trips_subtotal: quote.includedTripsSubtotal,
      extra_trips_subtotal: quote.extraTripsSubtotal,
      num_people: quote.numPeople,
      per_person: total / quote.numPeople,
      total,
      computed_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Quote API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
