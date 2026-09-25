// ─── Quote pricing data ───
//
// The single server-side pricing entry point, shared by:
//   * POST /api/quote          — public, rate-limited (AI chat, n8n)
//   * POST /api/admin/quote    — admin, no rate limit (manual booking preview)
//   * POST /api/admin/bookings — manual booking creation (authoritative total)
//
// It exists so the dashboard can show the employee the same number the server
// will actually charge. Before this, the admin manual-booking form had no
// pricing at all — a total was typed by hand and no price_snapshot was
// stored, which is why invoices for manual bookings could not show a
// breakdown.
//
// Security contract (unchanged from the original /api/quote route):
//   * every rate is fetched from the DB — client-sent prices are IGNORED
//   * upgrade_id is validated against the accommodation's own upgrade list
//   * internal pricing config rows are never returned to a caller
//
// Two outputs, deliberately:
//   `response` — the exact legacy JSON shape /api/quote has always returned,
//                so existing consumers (AI chat, n8n) are untouched.
//   `lines` + `snapshot` — a normalised breakdown for the admin UI, and the
//                frozen record to persist on the booking row.

import { z } from 'zod'
import {
  quotePackageV2,
  quoteTransfer,
  upgradeSubtotal,
  nightsForDuration,
  baseNightlyRoomRate,
  accommodationSubtotal,
  resolveNightlyRates,
  roomsForPeople,
  includedTripCost,
  extraTripCost,
  effectiveTripPrice,
  validateAndPriceTripPackages,
} from '@/lib/pricing'
import type { TripPriceInput } from '@/lib/pricing'
import type {
  Accommodation, BookingType, MealPlan, PriceSnapshot, RoomUpgrade, TransferPricing, TripPackage,
} from '@/lib/types'

export interface QuoteDataSource {
  getTransferPricing(): Promise<TransferPricing>
  getAccommodationById(id: string): Promise<Accommodation | null>
  getExtraTrips(ids: string[]): Promise<TripPriceInput[]>
  getTripPackages(ids: string[]): Promise<TripPackage[]>
}

type PricedExperiences = {
  extraTrips: TripPriceInput[]
  selectedPackages: TripPackage[]
  extraTripsSubtotal: number
  packagesSubtotal: number
}

type PricedExperiencesResult =
  | { ok: true; experiences: PricedExperiences }
  | { ok: false; error: string; code?: string }

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

/**
 * Shared request shape. Lives here rather than in a route file so the public
 * endpoint, the admin preview endpoint, and the manual-booking creation route
 * all validate identically — a field accepted by one must be accepted by all,
 * or a preview could differ from what actually gets charged.
 */
export const quoteSchema = z.object({
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),

  // Accommodation (required for package and accommodation-only)
  accommodation_id: z.string().uuid().optional(),

  // Package-specific. `nights` is supplied from the resolved stay pattern.
  duration: z.number().int().min(1).max(30).optional(),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  trip_package_ids: z.array(z.string().uuid()).optional(),

  // Accommodation-only, and resolved package nights.
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

export type QuoteInput = z.infer<typeof quoteSchema> & { booking_type: BookingType }

/**
 * One charged component, already bilingual, ready to render in the admin
 * preview and to become an invoice line. `detail` explains how the amount
 * was reached ("5 people x 950 EGP x 2 legs") — the missing piece that made
 * invoices unreadable.
 */
export interface QuoteLine {
  key: 'accommodation' | 'upgrade' | 'transfer' | 'meals' | 'extra_trips' | 'trip_packages'
  label_ar: string
  label_en: string
  detail_ar?: string
  detail_en?: string
  amount: number
}

export type QuoteResult =
  | { ok: false; status: number; error: string; code?: string }
  | {
      ok: true
      /** The legacy /api/quote JSON body, byte-compatible with existing consumers. */
      response: Record<string, unknown>
      lines: QuoteLine[]
      numPeople: number
      perPerson: number
      total: number
      /** False when the underlying pricing tables have not been configured yet. */
      isPriced: boolean
      snapshot: PriceSnapshot
    }

const TRANSFER_LABELS = {
  hiace: { ar: 'هايس خاص', en: 'Private Hiace' },
  package_bus: { ar: 'باص جماعي', en: 'Shared bus' },
} as const

const DIRECTION_LABELS = {
  to_dahab: { ar: 'ذهاب إلى دهب', en: 'To Dahab' },
  from_dahab: { ar: 'عودة من دهب', en: 'From Dahab' },
  round_trip: { ar: 'ذهاب وعودة', en: 'Round trip' },
} as const

const ROOM_LABELS = {
  single: { ar: 'غرفة مفردة', en: 'Single room' },
  double: { ar: 'غرفة مزدوجة', en: 'Double room' },
  triple: { ar: 'غرفة ثلاثية', en: 'Triple room' },
} as const

function people(ar: boolean, n: number): string {
  return ar ? `${n} ${n === 1 ? 'فرد' : 'أفراد'}` : `${n} ${n === 1 ? 'person' : 'people'}`
}

function nightsLabel(ar: boolean, n: number): string {
  return ar ? `${n} ${n === 1 ? 'ليلة' : 'ليالي'}` : `${n} night${n === 1 ? '' : 's'}`
}

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

/** Drops zero-value components so the preview and the invoice stay readable. */
function compact(lines: (QuoteLine | null)[]): QuoteLine[] {
  return lines.filter((l): l is QuoteLine => l !== null && l.amount > 0)
}

function transferConfigurationError(
  pricing: TransferPricing,
  type: 'package_bus' | 'hiace',
  governorate: string | undefined,
): string | null {
  const settings = pricing.settings.find((setting) => setting.transfer_type === type && setting.is_active)
  if (!settings || Number(settings.base_price) <= 0) return 'TRANSFER_NOT_PRICED'
  if (governorate && !pricing.governorates.some(
    (item) => item.transfer_type === type && item.governorate_code === governorate && item.is_active,
  )) return 'GOVERNORATE_UNAVAILABLE'
  return null
}

function allocationCapacity(allocations: NonNullable<QuoteInput['room_allocations']>): number {
  return allocations.reduce((total, allocation) => total + allocation.count * (
    allocation.type === 'single' ? 1 : allocation.type === 'double' ? 2 : 3
  ), 0)
}

/** Validates and prices customer-selected experiences for every booking type. */
async function priceSelectedExperiences(
  input: QuoteInput,
  source: QuoteDataSource,
  numPeople: number,
  now?: Date,
): Promise<PricedExperiencesResult> {
  const extraIds = Array.from(new Set(input.extra_trip_ids || []))
  const extraTrips = extraIds.length > 0 ? await source.getExtraTrips(extraIds) : []
  if (extraTrips.length !== extraIds.length) {
    return { ok: false, error: 'One or more extra trips are unavailable.', code: 'EXTRA_TRIP_UNAVAILABLE' }
  }

  const packageIds = Array.from(new Set(input.trip_package_ids || []))
  const selectedPackages = packageIds.length > 0 ? await source.getTripPackages(packageIds) : []
  if (selectedPackages.length !== packageIds.length) {
    return { ok: false, error: 'One or more selected Trip Packages are unavailable.' }
  }
  const { subtotal: packagesPerPersonSubtotal, error: packagesError } =
    validateAndPriceTripPackages(selectedPackages, extraIds)
  if (packagesError) return { ok: false, error: packagesError }

  return {
    ok: true,
    experiences: {
      extraTrips,
      selectedPackages,
      extraTripsSubtotal: extraTrips.reduce((sum, trip) => sum + extraTripCost(trip, now), 0) * numPeople,
      packagesSubtotal: packagesPerPersonSubtotal * numPeople,
    },
  }
}

function experienceLines(experiences: PricedExperiences, numPeople: number, now?: Date): (QuoteLine | null)[] {
  const { extraTrips, selectedPackages, extraTripsSubtotal, packagesSubtotal } = experiences
  return [
    extraTrips.length > 0 ? {
      key: 'extra_trips' as const,
      label_ar: 'رحلات إضافية',
      label_en: 'Extra trips',
      detail_ar: extraTrips.map((trip) => {
        const price = effectiveTripPrice(trip, now)
        return `${trip.name_en} (${price.isDiscounted ? `${price.original.toLocaleString('en-US')} ← ` : ''}${price.final.toLocaleString('en-US')} ج.م)`
      }).join(' + ') + ` × ${people(true, numPeople)}`,
      detail_en: extraTrips.map((trip) => {
        const price = effectiveTripPrice(trip, now)
        return `${trip.name_en} (${price.isDiscounted ? `${price.original.toLocaleString('en-US')} → ` : ''}${price.final.toLocaleString('en-US')} EGP)`
      }).join(' + ') + ` × ${people(false, numPeople)}`,
      amount: extraTripsSubtotal,
    } : null,
    packagesSubtotal > 0 ? {
      key: 'trip_packages' as const,
      label_ar: 'باقات الرحلات',
      label_en: 'Trip packages',
      detail_ar: `${selectedPackages.map((pkg) => pkg.name_ar).join(' + ')} × ${people(true, numPeople)}`,
      detail_en: `${selectedPackages.map((pkg) => pkg.name_en).join(' + ')} × ${people(false, numPeople)}`,
      amount: packagesSubtotal,
    } : null,
  ]
}

function experienceSnapshot(experiences: PricedExperiences, numPeople: number, now?: Date): Pick<
  PriceSnapshot,
  'extra_trips' | 'extra_trips_subtotal' | 'trip_packages' | 'trip_packages_subtotal'
> {
  const { extraTrips, selectedPackages, extraTripsSubtotal, packagesSubtotal } = experiences
  if (extraTrips.length === 0 && selectedPackages.length === 0) return {}
  return {
    extra_trips: extraTrips.map((trip) => {
      const price = effectiveTripPrice(trip, now)
      return {
        trip_id: trip.id,
        name_en: trip.name_en,
        price: price.final,
        ...(price.isDiscounted ? { price_before_discount: price.original, discount_per_person: price.discountAmount } : {}),
      }
    }),
    extra_trips_subtotal: extraTripsSubtotal,
    trip_packages: selectedPackages.map((pkg) => ({
      package_id: pkg.id,
      name_en: pkg.name_en,
      trip_names_en: (pkg.trips || []).map((trip) => trip.name_en),
      total: (pkg.totals?.packageTotal ?? 0) * numPeople,
    })),
    trip_packages_subtotal: packagesSubtotal,
  }
}

function experienceResponse(experiences: PricedExperiences, numPeople: number, now?: Date): Record<string, unknown> {
  const { extraTrips, selectedPackages, extraTripsSubtotal, packagesSubtotal } = experiences
  if (extraTrips.length === 0 && selectedPackages.length === 0) return {}
  return {
    extra_trips: extraTrips.map((trip) => ({ name: trip.name_en, cost: extraTripCost(trip, now) })),
    extra_trips_subtotal: extraTripsSubtotal,
    trip_packages: selectedPackages.map((pkg) => ({
      package_id: pkg.id,
      name: pkg.name_en,
      trip_names: (pkg.trips || []).map((trip) => trip.name_en),
      total: (pkg.totals?.packageTotal ?? 0) * numPeople,
    })),
    trip_packages_subtotal: packagesSubtotal,
  }
}

export async function computeQuote(
  input: QuoteInput,
  opts: { source: QuoteDataSource; now?: Date },
): Promise<QuoteResult> {
  const { source } = opts
  const computedAt = (opts.now ?? new Date()).toISOString()
  const numPeople = Math.max(1, Math.floor(input.num_people) || 1)

  // ─── transfer-only ───
  if (input.booking_type === 'transfer-only') {
    const pricedExperiences = await priceSelectedExperiences(input, source, numPeople, opts.now)
    if (!pricedExperiences.ok) {
      return { ok: false, status: 400, error: pricedExperiences.error, ...(pricedExperiences.code ? { code: pricedExperiences.code } : {}) }
    }
    const experiences = pricedExperiences.experiences
    const pricing = await source.getTransferPricing()
    const type = input.transfer_type ?? 'hiace'
    const direction = input.transfer_direction ?? 'to_dahab'
    const transferError = transferConfigurationError(pricing, type, input.governorate)
    if (transferError) {
      return {
        ok: false,
        status: 400,
        error: transferError === 'TRANSFER_NOT_PRICED' ? 'Transfer pricing is unavailable.' : 'Governorate is unavailable for this transfer.',
        code: transferError,
      }
    }
    const quote = quoteTransfer({
      pricing,
      type,
      governorateCode: input.governorate,
      direction,
      numPeople,
    })

    const total = quote.total + experiences.extraTripsSubtotal + experiences.packagesSubtotal
    const lines: QuoteLine[] = compact([
      {
        key: 'transfer',
        label_ar: `انتقالات — ${TRANSFER_LABELS[type].ar}`,
        label_en: `Transfer — ${TRANSFER_LABELS[type].en}`,
        detail_ar: `${people(true, quote.numPeople)} × ${quote.perPersonPerLeg.toLocaleString('en-US')} ج.م × ${quote.legs === 2 ? 'اتجاهين' : 'اتجاه واحد'} (${DIRECTION_LABELS[direction].ar})`,
        detail_en: `${people(false, quote.numPeople)} × ${quote.perPersonPerLeg.toLocaleString('en-US')} EGP × ${quote.legs} leg${quote.legs === 1 ? '' : 's'} (${DIRECTION_LABELS[direction].en})`,
        amount: quote.total,
      },
      ...experienceLines(experiences, numPeople, opts.now),
    ])

    return {
      ok: true,
      response: {
        booking_type: 'transfer-only',
        transfer_type: type,
        direction,
        per_person: total / quote.numPeople,
        num_people: quote.numPeople,
        total,
        is_priced: quote.isPriced,
        ...experienceResponse(experiences, numPeople, opts.now),
        computed_at: computedAt,
      },
      lines,
      numPeople: quote.numPeople,
      perPerson: total / quote.numPeople,
      total,
      isPriced: quote.isPriced,
      snapshot: {
        transfer_rate_used: quote.perPerson,
        transfer_subtotal: quote.total,
        ...experienceSnapshot(experiences, numPeople, opts.now),
        num_people: quote.numPeople,
        total,
        computed_at: computedAt,
      },
    }
  }

  if (!input.accommodation_id) {
    return { ok: false, status: 400, error: 'accommodation_id required' }
  }

  const acc = await source.getAccommodationById(input.accommodation_id)
  if (!acc) {
    return { ok: false, status: 404, error: 'Accommodation not found' }
  }

  const hasRoomPricing = Number(acc.price_double_room) > 0 || Number(acc.price_single_room) > 0
  const mealPlans = (acc.meal_plans || []) as MealPlan[]
  const mealPlan = mealPlans.find((m) => m.key === input.meal_plan_key && m.is_active)
  if (input.meal_plan_key && input.meal_plan_key !== 'none' && !mealPlan) {
    return { ok: false, status: 400, error: 'Meal plan is unavailable.', code: 'MEAL_PLAN_UNAVAILABLE' }
  }
  const mealPlanPricePerNight = mealPlan?.price_per_person_per_night ?? 0
  const accUpgrades: RoomUpgrade[] = acc.room_upgrades ?? []
  const requestedUpgradeIds = [input.upgrade_id, ...(input.room_allocations || []).map((allocation) => allocation.upgrade_id)]
  if (requestedUpgradeIds.some((id) => id && !resolveUpgrade(id, input.accommodation_id!, accUpgrades))) {
    return { ok: false, status: 400, error: 'Room upgrade is unavailable.', code: 'UPGRADE_UNAVAILABLE' }
  }
  if (input.room_allocations?.length && allocationCapacity(input.room_allocations) < numPeople) {
    return { ok: false, status: 400, error: 'Room allocations do not accommodate every guest.', code: 'ROOM_CAPACITY_EXCEEDED' }
  }

  const mealLine = (nights: number, amount: number): QuoteLine | null => {
    if (amount <= 0) return null
    return {
      key: 'meals',
      label_ar: `خطة الوجبات — ${mealPlan?.label_ar ?? ''}`.trim(),
      label_en: `Meal plan — ${mealPlan?.label_en ?? ''}`.trim(),
      detail_ar: `${people(true, numPeople)} × ${nightsLabel(true, nights)} × ${mealPlanPricePerNight.toLocaleString('en-US')} ج.م`,
      detail_en: `${people(false, numPeople)} × ${nightsLabel(false, nights)} × ${mealPlanPricePerNight.toLocaleString('en-US')} EGP`,
      amount,
    }
  }

  // ─── accommodation-only ───
  if (input.booking_type === 'accommodation-only') {
    const nights = input.nights ?? 1
    const pricedExperiences = await priceSelectedExperiences(input, source, numPeople, opts.now)
    if (!pricedExperiences.ok) {
      return { ok: false, status: 400, error: pricedExperiences.error, ...(pricedExperiences.code ? { code: pricedExperiences.code } : {}) }
    }
    const experiences = pricedExperiences.experiences

    if (hasRoomPricing) {
      if (input.room_allocations && input.room_allocations.length > 0) {
        let roomTotal = 0
        const allocBreakdown = []
        const allocSnapshots = []
        for (const alloc of input.room_allocations) {
          const nightly = resolveNightlyRates(acc, alloc.type, input.start_date, nights)
          const baseRate = baseNightlyRoomRate(acc, alloc.type)
          const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id, accUpgrades)
          const extra = upgrade ? upgrade.extra_price_per_night : 0
          const finalRate = baseRate + extra
          const subtotal = (accommodationSubtotal(nightly) + extra * nights) * alloc.count
          roomTotal += subtotal
          allocBreakdown.push({
            room_type: alloc.type,
            quantity: alloc.count,
            base_nightly_rate: baseRate,
            upgrade_name: upgrade?.name_en ?? null,
            upgrade_extra_per_night: extra,
            final_nightly_rate: finalRate,
            subtotal,
          })
          allocSnapshots.push({
            room_type: alloc.type,
            quantity: alloc.count,
            base_nightly_rate: baseRate,
            ...(upgrade ? { upgrade_id: upgrade.id, upgrade_name: upgrade.name_en } : {}),
            upgrade_extra_per_night: extra,
            final_nightly_rate: finalRate,
            nightly_rates: nightly.map((night) => ({
              date: night.date, rate: night.rate + extra, source: night.source,
              ...(night.seasonal_rate_name ? { seasonal_rate_name: night.seasonal_rate_name } : {}),
            })),
          })
        }
        const mealTotal = mealPlanPricePerNight * numPeople * nights
        const total = roomTotal + mealTotal + experiences.extraTripsSubtotal + experiences.packagesSubtotal
        const lines = compact([
          {
            key: 'accommodation' as const,
            label_ar: `${acc.name_ar} — الإقامة`,
            label_en: `${acc.name_en} — Accommodation`,
            detail_ar: allocBreakdown.map((a) => `${a.quantity} × ${ROOM_LABELS[a.room_type].ar} × ${nightsLabel(true, nights)}`).join(' + '),
            detail_en: allocBreakdown.map((a) => `${a.quantity} × ${ROOM_LABELS[a.room_type].en} × ${nightsLabel(false, nights)}`).join(' + '),
            amount: roomTotal,
          },
          mealLine(nights, mealTotal),
          ...experienceLines(experiences, numPeople, opts.now),
        ])
        return {
          ok: true,
          response: {
            booking_type: 'accommodation-only',
            accommodation_name: acc.name_en,
            nights,
            room_allocations: allocBreakdown,
            meal_plan: mealPlan ? { key: mealPlan.key, label: mealPlan.label_en, price_per_person_per_night: mealPlanPricePerNight } : null,
            meal_subtotal: mealTotal,
            ...experienceResponse(experiences, numPeople, opts.now),
            accommodation_subtotal: roomTotal,
            num_people: numPeople,
            per_person: total / numPeople,
            total,
            computed_at: computedAt,
          },
          lines,
          numPeople,
          perPerson: total / numPeople,
          total,
          isPriced: roomTotal > 0,
          snapshot: {
            room_allocations: allocSnapshots,
            nights,
            accommodation_subtotal: roomTotal,
            ...(mealPlan ? { meal_plan_key: mealPlan.key } : {}),
            meal_plan_price_per_person_per_night: mealPlanPricePerNight,
            meal_subtotal: mealTotal,
            ...experienceSnapshot(experiences, numPeople, opts.now),
            num_people: numPeople,
            total,
            computed_at: computedAt,
          },
        }
      }

      const roomType = input.room_type ?? 'double'
      const numRooms = roomsForPeople(roomType, numPeople)
      const upgrade = resolveUpgrade(input.upgrade_id, input.accommodation_id, accUpgrades)
      const upgradeExtra = upgrade ? upgrade.extra_price_per_night : 0
      const nightly = resolveNightlyRates(acc, roomType, input.start_date, nights)
      const accSubtotal = accommodationSubtotal(nightly, numRooms)
      const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
      const mealTotal = mealPlanPricePerNight * numPeople * nights
      const total = accSubtotal + upgradeTotal + mealTotal + experiences.extraTripsSubtotal + experiences.packagesSubtotal
      const lines = compact([
        {
          key: 'accommodation' as const,
          label_ar: `${acc.name_ar} — ${ROOM_LABELS[roomType].ar}`,
          label_en: `${acc.name_en} — ${ROOM_LABELS[roomType].en}`,
          detail_ar: `${numRooms} ${numRooms === 1 ? 'غرفة' : 'غرف'} × ${nightsLabel(true, nights)}`,
          detail_en: `${numRooms} room${numRooms === 1 ? '' : 's'} × ${nightsLabel(false, nights)}`,
          amount: accSubtotal,
        },
        upgrade ? {
          key: 'upgrade' as const,
          label_ar: `ترقية الغرفة — ${upgrade.name_ar}`,
          label_en: `Room upgrade — ${upgrade.name_en}`,
          detail_ar: `${numRooms} ${numRooms === 1 ? 'غرفة' : 'غرف'} × ${nightsLabel(true, nights)} × ${upgradeExtra.toLocaleString('en-US')} ج.م`,
          detail_en: `${numRooms} room${numRooms === 1 ? '' : 's'} × ${nightsLabel(false, nights)} × ${upgradeExtra.toLocaleString('en-US')} EGP`,
          amount: upgradeTotal,
        } : null,
        mealLine(nights, mealTotal),
        ...experienceLines(experiences, numPeople, opts.now),
      ])
      return {
        ok: true,
        response: {
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
          ...experienceResponse(experiences, numPeople, opts.now),
          num_people: numPeople,
          per_person: total / numPeople,
          total,
          computed_at: computedAt,
        },
        lines,
        numPeople,
        perPerson: total / numPeople,
        total,
        isPriced: accSubtotal > 0,
        snapshot: {
          room_type: roomType,
          num_rooms: numRooms,
          nightly_room_rates: nightly.map((n) => ({
            date: n.date, rate: n.rate, source: n.source,
            ...(n.seasonal_rate_name ? { seasonal_rate_name: n.seasonal_rate_name } : {}),
          })),
          nights,
          accommodation_subtotal: accSubtotal + upgradeTotal,
          ...(mealPlan ? { meal_plan_key: mealPlan.key } : {}),
          meal_plan_price_per_person_per_night: mealPlanPricePerNight,
          meal_subtotal: mealTotal,
          ...experienceSnapshot(experiences, numPeople, opts.now),
          num_people: numPeople,
          total,
          computed_at: computedAt,
        },
      }
    }

    // Legacy flat nightly rate — accommodation predates room-based pricing.
    const legacyTotal = Number(acc.price_per_night) * nights * numPeople
    const total = legacyTotal + experiences.extraTripsSubtotal + experiences.packagesSubtotal
    return {
      ok: true,
      response: {
        booking_type: 'accommodation-only',
        accommodation_name: acc.name_en,
        nights,
        num_people: numPeople,
        per_person: experiences.extraTrips.length || experiences.selectedPackages.length
          ? total / numPeople
          : Number(acc.price_per_night),
        total,
        ...experienceResponse(experiences, numPeople, opts.now),
        computed_at: computedAt,
      },
      lines: compact([
        {
          key: 'accommodation',
          label_ar: `${acc.name_ar} — الإقامة`,
          label_en: `${acc.name_en} — Accommodation`,
          detail_ar: `${people(true, numPeople)} × ${nightsLabel(true, nights)} × ${Number(acc.price_per_night).toLocaleString('en-US')} ج.م`,
          detail_en: `${people(false, numPeople)} × ${nightsLabel(false, nights)} × ${Number(acc.price_per_night).toLocaleString('en-US')} EGP`,
          amount: legacyTotal,
        },
        ...experienceLines(experiences, numPeople, opts.now),
      ]),
      numPeople,
      perPerson: total / numPeople,
      total,
      isPriced: legacyTotal > 0,
      snapshot: {
        nights,
        ...({ pricing_model: 'legacy' } as object),
        accommodation_subtotal: legacyTotal,
        ...experienceSnapshot(experiences, numPeople, opts.now),
        num_people: numPeople,
        total,
        computed_at: computedAt,
      },
    }
  }

  // ─── package ───
  // The 2 free Sinai trips are a fixed marketing benefit shown alongside
  // every package quote — not tied to specific trip records, so no
  // "included trips" are ever fetched or priced here.
  const pricing = await source.getTransferPricing()
  const extraIds = Array.from(new Set(input.extra_trip_ids || []))

  const includedTrips: TripPriceInput[] = []
  let extraTrips: TripPriceInput[] = []
  if (extraIds.length > 0) {
    extraTrips = await source.getExtraTrips(extraIds)
    if (extraTrips.length !== extraIds.length) {
      return { ok: false, status: 400, error: 'One or more extra trips are unavailable.', code: 'EXTRA_TRIP_UNAVAILABLE' }
    }
  }

  const packageIds = Array.from(new Set(input.trip_package_ids || []))
  const selectedPackages = packageIds.length > 0 ? await source.getTripPackages(packageIds) : []
  if (selectedPackages.length !== packageIds.length) {
    return { ok: false, status: 400, error: 'One or more selected Trip Packages are unavailable.' }
  }
  const { subtotal: packagesPerPersonSubtotal, error: packagesError } =
    validateAndPriceTripPackages(selectedPackages, extraIds)
  if (packagesError) {
    return { ok: false, status: 400, error: packagesError }
  }
  const packagesSubtotal = packagesPerPersonSubtotal * numPeople
  const tripPackagesResponse = selectedPackages.map((p) => ({
    package_id: p.id,
    name: p.name_en,
    trip_names: (p.trips || []).map((t) => t.name_en),
    total: (p.totals?.packageTotal ?? 0) * numPeople,
  }))

  const transferType = input.transfer_type ?? 'hiace'
  const direction = input.transfer_direction ?? 'round_trip'
  const transferError = transferConfigurationError(
    pricing,
    hasRoomPricing ? transferType : 'package_bus',
    input.governorate,
  )
  if (transferError) {
    return {
      ok: false,
      status: 400,
      error: transferError === 'TRANSFER_NOT_PRICED' ? 'Transfer pricing is unavailable.' : 'Governorate is unavailable for this transfer.',
      code: transferError,
    }
  }
  const legacyNights = input.duration == null || input.duration === 4 || input.duration === 5
    ? nightsForDuration(input.duration === 5 ? 5 : 4)
    : undefined
  const nights = input.nights ?? legacyNights
  if (nights == null) {
    return {
      ok: false,
      status: 400,
      error: 'Package nights must come from an active stay pattern.',
      code: 'PACKAGE_NIGHTS_REQUIRED',
    }
  }
  const extraTripsSubtotal = extraTrips.reduce((s, t) => s + extraTripCost(t), 0) * numPeople

  const tripLines = (): (QuoteLine | null)[] => [
    extraTrips.length > 0 ? {
      key: 'extra_trips' as const,
      label_ar: 'رحلات إضافية',
      label_en: 'Extra trips',
      detail_ar: extraTrips.map((t) => {
        const p = effectiveTripPrice(t)
        return `${t.name_en} (${p.isDiscounted ? `${p.original.toLocaleString('en-US')} ← ` : ''}${p.final.toLocaleString('en-US')} ج.م)`
      }).join(' + ') + ` × ${people(true, numPeople)}`,
      detail_en: extraTrips.map((t) => {
        const p = effectiveTripPrice(t)
        return `${t.name_en} (${p.isDiscounted ? `${p.original.toLocaleString('en-US')} → ` : ''}${p.final.toLocaleString('en-US')} EGP)`
      }).join(' + ') + ` × ${people(false, numPeople)}`,
      amount: extraTripsSubtotal,
    } : null,
    packagesSubtotal > 0 ? {
      key: 'trip_packages' as const,
      label_ar: 'باقات الرحلات',
      label_en: 'Trip packages',
      detail_ar: `${selectedPackages.map((p) => p.name_ar).join(' + ')} × ${people(true, numPeople)}`,
      detail_en: `${selectedPackages.map((p) => p.name_en).join(' + ')} × ${people(false, numPeople)}`,
      amount: packagesSubtotal,
    } : null,
  ]

  const transferLine = (quote: ReturnType<typeof quoteTransfer>): QuoteLine => ({
    key: 'transfer',
    label_ar: `انتقالات — ${TRANSFER_LABELS[transferType].ar}`,
    label_en: `Transfer — ${TRANSFER_LABELS[transferType].en}`,
    detail_ar: `${people(true, quote.numPeople)} × ${quote.perPersonPerLeg.toLocaleString('en-US')} ج.م × ${quote.legs === 2 ? 'اتجاهين' : 'اتجاه واحد'} (${DIRECTION_LABELS[direction].ar})`,
    detail_en: `${people(false, quote.numPeople)} × ${quote.perPersonPerLeg.toLocaleString('en-US')} EGP × ${quote.legs} leg${quote.legs === 1 ? '' : 's'} (${DIRECTION_LABELS[direction].en})`,
    amount: quote.total,
  })

  if (!hasRoomPricing) {
    // Legacy flat package price
    const accommodationPrice = input.duration === 5 ? Number(acc.price_5day) : Number(acc.price_4day)
    const transferQuote = quoteTransfer({ pricing, type: 'package_bus', governorateCode: input.governorate, direction, numPeople })
    const total = (accommodationPrice + transferQuote.perPerson) * numPeople
    return {
      ok: true,
      response: {
        booking_type: 'package',
        accommodation_name: acc.name_en,
        duration: input.duration ?? 4,
        nights,
        per_person: total / numPeople,
        num_people: numPeople,
        total,
        computed_at: computedAt,
      },
      lines: compact([
        {
          key: 'accommodation',
          label_ar: `${acc.name_ar} — باقة ${input.duration ?? 4} أيام`,
          label_en: `${acc.name_en} — ${input.duration ?? 4}-day package`,
          detail_ar: `${people(true, numPeople)} × ${accommodationPrice.toLocaleString('en-US')} ج.م`,
          detail_en: `${people(false, numPeople)} × ${accommodationPrice.toLocaleString('en-US')} EGP`,
          amount: accommodationPrice * numPeople,
        },
        transferLine(transferQuote),
      ]),
      numPeople,
      perPerson: total / numPeople,
      total,
      isPriced: total > 0,
      snapshot: {
        nights,
        ...({ pricing_model: 'legacy' } as object),
        accommodation_subtotal: accommodationPrice * numPeople,
        transfer_rate_used: transferQuote.perPerson,
        transfer_subtotal: transferQuote.total,
        num_people: numPeople,
        total,
        computed_at: computedAt,
      },
    }
  }

  if (input.room_allocations && input.room_allocations.length > 0) {
    let roomTotal = 0
    const allocBreakdown = []
    const allocSnapshots = []
    for (const alloc of input.room_allocations) {
      const nightly = resolveNightlyRates(acc, alloc.type, input.start_date, nights)
      const baseRate = baseNightlyRoomRate(acc, alloc.type)
      const upgrade = resolveUpgrade(alloc.upgrade_id, input.accommodation_id, accUpgrades)
      const extra = upgrade ? upgrade.extra_price_per_night : 0
      const finalRate = baseRate + extra
      const subtotal = (accommodationSubtotal(nightly) + extra * nights) * alloc.count
      roomTotal += subtotal
      allocBreakdown.push({
        room_type: alloc.type,
        quantity: alloc.count,
        base_nightly_rate: baseRate,
        upgrade_name: upgrade?.name_en ?? null,
        upgrade_extra_per_night: extra,
        final_nightly_rate: finalRate,
        subtotal,
      })
      allocSnapshots.push({
        room_type: alloc.type,
        quantity: alloc.count,
        base_nightly_rate: baseRate,
        ...(upgrade ? { upgrade_id: upgrade.id, upgrade_name: upgrade.name_en } : {}),
        upgrade_extra_per_night: extra,
        final_nightly_rate: finalRate,
        nightly_rates: nightly.map((night) => ({
          date: night.date, rate: night.rate + extra, source: night.source,
          ...(night.seasonal_rate_name ? { seasonal_rate_name: night.seasonal_rate_name } : {}),
        })),
      })
    }
    const mealTotal = mealPlanPricePerNight * numPeople * nights
    const transferQuote = quoteTransfer({ pricing, type: transferType, governorateCode: input.governorate, direction, numPeople })
    let tripsTotal = 0
    for (const t of includedTrips) tripsTotal += includedTripCost(t) * numPeople
    for (const t of extraTrips) tripsTotal += extraTripCost(t) * numPeople
    const total = roomTotal + mealTotal + transferQuote.total + tripsTotal + packagesSubtotal
    return {
      ok: true,
      response: {
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
        included_trips: includedTrips.map((t) => ({ name: t.name_en, cost: includedTripCost(t) })),
        extra_trips: extraTrips.map((t) => ({ name: t.name_en, cost: extraTripCost(t) })),
        trips_subtotal: tripsTotal,
        trip_packages: tripPackagesResponse,
        trip_packages_subtotal: packagesSubtotal,
        num_people: numPeople,
        per_person: total / numPeople,
        total,
        computed_at: computedAt,
      },
      lines: compact([
        {
          key: 'accommodation',
          label_ar: `${acc.name_ar} — الإقامة`,
          label_en: `${acc.name_en} — Accommodation`,
          detail_ar: allocBreakdown.map((a) => `${a.quantity} × ${ROOM_LABELS[a.room_type].ar} × ${nightsLabel(true, nights)}`).join(' + '),
          detail_en: allocBreakdown.map((a) => `${a.quantity} × ${ROOM_LABELS[a.room_type].en} × ${nightsLabel(false, nights)}`).join(' + '),
          amount: roomTotal,
        },
        transferLine(transferQuote),
        mealLine(nights, mealTotal),
        ...tripLines(),
      ]),
      numPeople,
      perPerson: total / numPeople,
      total,
      isPriced: roomTotal > 0,
      snapshot: {
        room_allocations: allocSnapshots,
        nights,
        accommodation_subtotal: roomTotal,
        transfer_rate_used: transferQuote.perPerson,
        transfer_subtotal: transferQuote.total,
        ...(mealPlan ? { meal_plan_key: mealPlan.key } : {}),
        meal_plan_price_per_person_per_night: mealPlanPricePerNight,
        meal_subtotal: mealTotal,
        extra_trips: extraTrips.map((t) => {
          const p = effectiveTripPrice(t)
          return {
            trip_id: t.id,
            name_en: t.name_en,
            price: p.final,
            ...(p.isDiscounted ? { price_before_discount: p.original, discount_per_person: p.discountAmount } : {}),
          }
        }),
        extra_trips_subtotal: extraTripsSubtotal,
        trip_packages: selectedPackages.map((p) => ({
          package_id: p.id,
          name_en: p.name_en,
          trip_names_en: (p.trips || []).map((t) => t.name_en),
          total: (p.totals?.packageTotal ?? 0) * numPeople,
        })),
        trip_packages_subtotal: packagesSubtotal,
        num_people: numPeople,
        total,
        computed_at: computedAt,
      },
    }
  }

  // Single room type
  const roomType = input.room_type ?? 'double'
  const numRooms = roomsForPeople(roomType, numPeople)
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
    numPeople,
  })
  const upgradeTotal = upgradeSubtotal(upgradeExtra, numRooms, nights)
  const total = quote.total + upgradeTotal + packagesSubtotal

  return {
    ok: true,
    response: {
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
      included_trips: includedTrips.map((t) => ({ name: t.name_en, cost: includedTripCost(t) })),
      extra_trips: extraTrips.map((t) => ({ name: t.name_en, cost: extraTripCost(t) })),
      included_trips_subtotal: quote.includedTripsSubtotal,
      extra_trips_subtotal: quote.extraTripsSubtotal,
      trip_packages: tripPackagesResponse,
      trip_packages_subtotal: packagesSubtotal,
      num_people: quote.numPeople,
      per_person: total / quote.numPeople,
      total,
      computed_at: computedAt,
    },
    lines: compact([
      {
        key: 'accommodation',
        label_ar: `${acc.name_ar} — ${ROOM_LABELS[roomType].ar}`,
        label_en: `${acc.name_en} — ${ROOM_LABELS[roomType].en}`,
        detail_ar: `${numRooms} ${numRooms === 1 ? 'غرفة' : 'غرف'} × ${nightsLabel(true, quote.nights)}`,
        detail_en: `${numRooms} room${numRooms === 1 ? '' : 's'} × ${nightsLabel(false, quote.nights)}`,
        amount: quote.accommodationSubtotal,
      },
      upgrade ? {
        key: 'upgrade' as const,
        label_ar: `ترقية الغرفة — ${upgrade.name_ar}`,
        label_en: `Room upgrade — ${upgrade.name_en}`,
        detail_ar: `${numRooms} ${numRooms === 1 ? 'غرفة' : 'غرف'} × ${nightsLabel(true, quote.nights)} × ${upgradeExtra.toLocaleString('en-US')} ج.م`,
        detail_en: `${numRooms} room${numRooms === 1 ? '' : 's'} × ${nightsLabel(false, quote.nights)} × ${upgradeExtra.toLocaleString('en-US')} EGP`,
        amount: upgradeTotal,
      } : null,
      transferLine(quote.transfer),
      mealLine(quote.nights, quote.mealSubtotal),
      ...tripLines(),
    ]),
    numPeople: quote.numPeople,
    perPerson: total / quote.numPeople,
    total,
    isPriced: quote.accommodationSubtotal > 0,
    snapshot: {
      room_type: roomType,
      num_rooms: quote.numRooms,
      nightly_room_rates: quote.nightly.map((n) => ({
        date: n.date, rate: n.rate, source: n.source,
        ...(n.seasonal_rate_name ? { seasonal_rate_name: n.seasonal_rate_name } : {}),
      })),
      nights: quote.nights,
      accommodation_subtotal: quote.accommodationSubtotal + upgradeTotal,
      transfer_rate_used: quote.transfer.perPerson,
      transfer_subtotal: quote.transferSubtotal,
      included_trips: [],
      included_trips_subtotal: quote.includedTripsSubtotal,
      ...(mealPlan ? { meal_plan_key: mealPlan.key } : {}),
      meal_plan_price_per_person_per_night: mealPlanPricePerNight,
      meal_subtotal: quote.mealSubtotal,
      extra_trips: extraTrips.map((t) => {
        const p = effectiveTripPrice(t)
        return {
          trip_id: t.id,
          name_en: t.name_en,
          price: p.final,
          ...(p.isDiscounted ? { price_before_discount: p.original, discount_per_person: p.discountAmount } : {}),
        }
      }),
      extra_trips_subtotal: quote.extraTripsSubtotal,
      trip_packages: selectedPackages.map((p) => ({
        package_id: p.id,
        name_en: p.name_en,
        trip_names_en: (p.trips || []).map((t) => t.name_en),
        total: (p.totals?.packageTotal ?? 0) * numPeople,
      })),
      trip_packages_subtotal: packagesSubtotal,
      num_people: quote.numPeople,
      total,
      computed_at: computedAt,
    },
  }
}
