// ─── Shared booking pricing engine ───
// Extracted from the public /api/bookings route so the exact same pricing
// logic can be reused by the admin dashboard's manual-booking "auto price"
// quote endpoint. There must only ever be ONE implementation of this math —
// duplicating it risks the admin and public prices silently drifting apart.

import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTransferPricing, getAccommodationById } from '@/lib/data'
import {
  quotePackage, quotePackageV2, quoteTransfer,
  buildPriceSnapshot, buildStaySnapshot,
  nightsForDuration, isPackageDepartureDay, isPackageReturnDay, roomsForPeople,
  baseNightlyRoomRate, upgradeSubtotal,
} from '@/lib/pricing'
import type { TripPriceInput } from '@/lib/pricing'
import type { MealPlan, PriceSnapshot, RoomUpgrade } from '@/lib/types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

export const bookingSchema = z.object({
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
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
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

export type BookingInput = z.infer<typeof bookingSchema>

/** Same shape, but every field optional and no superRefine — for admin "auto price"
 *  previews where the form may still be half-filled while the admin is typing. */
export const bookingQuoteSchema = z.object({
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
  upgrade_id: z.string().uuid().optional(),
  meal_plan_key: z.string().optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50).default(1),
})

export interface PricingResult {
  total_price: number | null
  price_snapshot: PriceSnapshot | null
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
 * tables. Whatever the caller thinks the price is, is only ever a preview.
 * Every priced booking freezes a `price_snapshot` — see lib/pricing.ts — so a
 * later change to hotel/trip/transfer prices can never retroactively change
 * what this customer was quoted.
 */
export async function priceBooking(
  input: Pick<BookingInput,
    | 'booking_type' | 'accommodation_id' | 'governorate' | 'trip_date' | 'duration' | 'nights'
    | 'transfer_type' | 'transfer_direction' | 'room_type' | 'upgrade_id' | 'room_allocations'
    | 'meal_plan_key' | 'extra_trip_ids' | 'num_people'
  >,
): Promise<PricingResult> {
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
      for (const t of includedTrips) tripsTotal += (t.package_price ?? t.price) * input.num_people
      for (const t of extraTrips) tripsTotal += (t.package_price ?? t.price) * input.num_people
      const total = roomTotal + mealTotal + transferQuote.total + tripsTotal
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
          included_trips: includedTrips.map((t) => ({ trip_id: t.id, name_en: t.name_en, package_cost: t.package_price ?? t.price })),
          extra_trips: extraTrips.map((t) => ({ trip_id: t.id, name_en: t.name_en, price: t.price })),
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
    const totalWithUpgrade = quote.total + upgradeTotal
    const baseSnapshot = buildPriceSnapshot(quoteInput, quote)
    const snapshot: PriceSnapshot = {
      ...baseSnapshot,
      total: totalWithUpgrade,
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
export function validateDates(input: Pick<BookingInput, 'booking_type' | 'transfer_type' | 'transfer_direction' | 'trip_date' | 'return_date'>): string | null {
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
