// ─── Transfer pricing — pure helpers ───
//
// Everything here is a pure function over values that come from Supabase
// (transfer_settings + transfer_governorate_pricing). There are deliberately
// NO hardcoded prices in this file: the dashboard is the single source of truth.
//
// The pricing model, in one line:
//   price per person, one direction = base_price(type) + surcharge(type, governorate)
//   round trip                      = that, doubled
//   total                           = that, times the number of people

import { formatAmount } from './format'
import type {
  AccommodationSeasonalRate,
  PriceSnapshot,
  SinaiTrip,
  TransferDirection,
  TransferGovernoratePrice,
  TransferPricing,
  TransferSettings,
  TransferType,
} from './types'

// ─── Day-of-week rules ───
// JS Date#getDay(): 0 = Sunday … 6 = Saturday
export const SUNDAY = 0
export const MONDAY = 1
export const THURSDAY = 4
export const FRIDAY = 5

/** A package bus leaves for Dahab only on Sunday or Thursday. */
export const PACKAGE_DEPARTURE_DAYS: readonly number[] = [SUNDAY, THURSDAY]
/** A package bus comes back from Dahab only on Monday or Friday. */
export const PACKAGE_RETURN_DAYS: readonly number[] = [MONDAY, FRIDAY]

/** Hiace transfers run every day — no day restriction at all. */
export const HIACE_DAYS: readonly number[] | null = null

export function isPackageDepartureDay(date: Date | string): boolean {
  return PACKAGE_DEPARTURE_DAYS.includes(toDate(date).getDay())
}

export function isPackageReturnDay(date: Date | string): boolean {
  return PACKAGE_RETURN_DAYS.includes(toDate(date).getDay())
}

function toDate(d: Date | string): Date {
  return d instanceof Date ? d : new Date(`${d}T00:00:00`)
}

/** ISO `YYYY-MM-DD` in local time (avoids the UTC off-by-one of toISOString). */
export function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * The next `count` dates matching `allowedDays`, starting from `from` (inclusive).
 * Used to build the date pickers so the customer can only pick a valid day.
 */
export function upcomingDatesFor(
  allowedDays: readonly number[] | null,
  count = 12,
  from: Date = new Date(),
): string[] {
  const out: string[] = []
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  // look at most ~6 months ahead so a bad `allowedDays` can never spin forever
  for (let i = 0; i < 190 && out.length < count; i++) {
    if (!allowedDays || allowedDays.includes(cursor.getDay())) {
      out.push(toISODate(cursor))
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

// ─── Lookups ───

export function findSettings(
  pricing: TransferPricing,
  type: TransferType,
): TransferSettings | undefined {
  return pricing.settings.find((s) => s.transfer_type === type)
}

export function governoratesFor(
  pricing: TransferPricing,
  type: TransferType,
): TransferGovernoratePrice[] {
  return pricing.governorates
    .filter((g) => g.transfer_type === type && g.is_active)
    .sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en))
}

export function findGovernorate(
  pricing: TransferPricing,
  type: TransferType,
  code: string | undefined | null,
): TransferGovernoratePrice | undefined {
  if (!code) return undefined
  return pricing.governorates.find(
    (g) => g.transfer_type === type && g.governorate_code === code,
  )
}

// ─── The actual maths ───

/** Legs travelled: a round trip is two, anything else is one. */
export function legsFor(direction: TransferDirection): 1 | 2 {
  return direction === 'round_trip' ? 2 : 1
}

export interface TransferQuoteInput {
  pricing: TransferPricing
  type: TransferType
  governorateCode?: string | null
  direction: TransferDirection
  numPeople: number
}

export interface TransferQuote {
  /** Cairo base for one direction, per person. */
  basePrice: number
  /** Governorate surcharge for one direction, per person. */
  surcharge: number
  /** basePrice + surcharge — one direction, one person. */
  perPersonPerLeg: number
  /** 1 or 2. */
  legs: 1 | 2
  /** perPersonPerLeg * legs. */
  perPerson: number
  numPeople: number
  /** perPerson * numPeople — what the customer actually pays. */
  total: number
  /** False when the pricing tables have not been filled in yet. */
  isPriced: boolean
}

export function quoteTransfer({
  pricing,
  type,
  governorateCode,
  direction,
  numPeople,
}: TransferQuoteInput): TransferQuote {
  const settings = findSettings(pricing, type)
  const gov = findGovernorate(pricing, type, governorateCode)

  const basePrice = Number(settings?.base_price ?? 0)
  const surcharge = Number(gov?.price_surcharge ?? 0)
  const perPersonPerLeg = basePrice + surcharge
  const legs = legsFor(direction)
  const perPerson = perPersonPerLeg * legs
  const people = Math.max(1, Math.floor(numPeople) || 1)

  return {
    basePrice,
    surcharge,
    perPersonPerLeg,
    legs,
    perPerson,
    numPeople: people,
    total: perPerson * people,
    isPriced: Boolean(settings) && perPersonPerLeg > 0,
  }
}

// ─── Package pricing (accommodation + transfer) ───

export interface PackageQuoteInput {
  pricing: TransferPricing
  /** Accommodation price for the chosen package length, per person. */
  accommodationPrice: number
  governorateCode?: string | null
  /** The package bus is one-way or round trip — same 400 x 2 rule. */
  direction: TransferDirection
  numPeople: number
}

export interface PackageQuote {
  accommodationPerPerson: number
  transfer: TransferQuote
  perPerson: number
  numPeople: number
  total: number
}

export function quotePackage({
  pricing,
  accommodationPrice,
  governorateCode,
  direction,
  numPeople,
}: PackageQuoteInput): PackageQuote {
  const transfer = quoteTransfer({
    pricing,
    type: 'package_bus',
    governorateCode,
    direction,
    numPeople,
  })
  const accommodationPerPerson = Number(accommodationPrice) || 0
  const perPerson = accommodationPerPerson + transfer.perPerson
  return {
    accommodationPerPerson,
    transfer,
    perPerson,
    numPeople: transfer.numPeople,
    total: perPerson * transfer.numPeople,
  }
}

// ─── Room-based accommodation pricing ───
//
// Replaces the old "admin types in a flat package price" model. The
// per-person price is now built from real components so it always reflects
// what's actually configured on the accommodation + site settings:
//
//   room (double/triple → price_double_room / 2, single → price_single_room)
//   + meal plan add-on (per person, per night)
//   + the trips bundled into every package by default ("x")
//   + transfer (per person, from quoteTransfer — bus or Hiace, by governorate)
//   ────────────────────────────────────────────────────────────────
//   = per-person package price, × number of people
//   + any extra Sinai trips the customer added on top, × number of people
//
// This lives entirely on the server (priced in the booking API route) —
// the client only ever sees the resulting total, never the formula.

export type RoomType = 'double' | 'single' | 'triple'

export interface RoomPriceInput {
  price_double_room: number
  price_single_room: number
  price_triple_room?: number
  /** Active date-range overrides for this accommodation (optional). */
  seasonal_rates?: AccommodationSeasonalRate[]
}

/** How many people the room type is priced for. */
export function roomOccupancy(roomType: RoomType): number {
  if (roomType === 'single') return 1
  if (roomType === 'triple') return 3
  return 2
}

/** Minimum number of rooms needed for the selected party and room type. */
export function roomsForPeople(roomType: RoomType, numPeople: number): number {
  const people = Math.max(1, Math.floor(numPeople) || 1)
  return Math.ceil(people / roomOccupancy(roomType))
}

/**
 * The BASE nightly rate for a room type (no seasonal override).
 * Always the TOTAL room price — per-person shares are derived, never stored.
 * A missing triple rate falls back to double × 1.5 as a display suggestion,
 * matching the admin UI default (which stays editable, never hardcoded).
 */
export function baseNightlyRoomRate(acc: RoomPriceInput, roomType: RoomType): number {
  if (roomType === 'single') return Number(acc.price_single_room) || 0
  if (roomType === 'triple') {
    const triple = Number(acc.price_triple_room) || 0
    if (triple > 0) return triple
    return (Number(acc.price_double_room) || 0) * 1.5
  }
  return Number(acc.price_double_room) || 0
}

/** Per-person share of the base nightly rate (kept for stay-only / legacy callers). */
export function roomPerPersonPrice(acc: RoomPriceInput, roomType: RoomType): number {
  return baseNightlyRoomRate(acc, roomType) / roomOccupancy(roomType)
}

// ─── Seasonal night-by-night resolution ───

export interface ResolvedNight {
  /** ISO date of the night (the evening the guest sleeps). */
  date: string
  /** TOTAL room rate for that night. */
  rate: number
  source: 'seasonal' | 'base'
  seasonal_rate_name?: string
}

function seasonalRateFor(
  rates: AccommodationSeasonalRate[] | undefined,
  isoDate: string,
): AccommodationSeasonalRate | undefined {
  if (!rates?.length) return undefined
  // start_date/end_date are inclusive; the DB guards against overlapping
  // active periods, so at most one row can match.
  return rates.find(
    (r) => r.is_active && r.start_date <= isoDate && isoDate <= r.end_date,
  )
}

function seasonalPriceForRoom(rate: AccommodationSeasonalRate, roomType: RoomType): number {
  if (roomType === 'single') return Number(rate.single_price) || 0
  if (roomType === 'triple') return Number(rate.triple_price) || 0
  return Number(rate.double_price) || 0
}

/**
 * Resolve the TOTAL room rate for EVERY night of a stay individually.
 * A stay that crosses a seasonal boundary is charged night-by-night — never
 * priced wholesale from the check-in date. A night with no active seasonal
 * period (or a seasonal price of 0) falls back to the accommodation base rate.
 */
export function resolveNightlyRates(
  acc: RoomPriceInput,
  roomType: RoomType,
  checkIn: Date | string,
  nights: number,
): ResolvedNight[] {
  const out: ResolvedNight[] = []
  const cursor = toDate(checkIn)
  const n = Math.max(0, Math.floor(nights) || 0)
  const base = baseNightlyRoomRate(acc, roomType)
  for (let i = 0; i < n; i++) {
    const iso = toISODate(cursor)
    const seasonal = seasonalRateFor(acc.seasonal_rates, iso)
    const seasonalPrice = seasonal ? seasonalPriceForRoom(seasonal, roomType) : 0
    if (seasonal && seasonalPrice > 0) {
      out.push({ date: iso, rate: seasonalPrice, source: 'seasonal', seasonal_rate_name: seasonal.name })
    } else {
      out.push({ date: iso, rate: base, source: 'base' })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/** Sum of TOTAL room rates across a stay (one room). Multiply by numRooms if needed. */
export function accommodationSubtotal(nightly: ResolvedNight[], numRooms = 1): number {
  return nightly.reduce((sum, n) => sum + n.rate, 0) * Math.max(1, numRooms)
}

/**
 * The extra cost of a room upgrade for a given stay.
 * extra_price_per_night is a FIXED supplement per ROOM per night (not per person).
 * Multiply by numRooms and nights to get the total upgrade add-on.
 * Returns 0 when extraPerNight is 0, undefined, or NaN.
 */
export function upgradeSubtotal(
  extraPerNight: number,
  numRooms: number,
  nights: number,
): number {
  const extra = Number(extraPerNight) || 0
  return extra * Math.max(1, numRooms) * Math.max(0, nights)
}

// ─── Trip pricing (public vs package cost) ───

export interface TripPriceInput {
  id: string
  name_en: string
  price: number
  package_price?: number | null
}

/**
 * The two INCLUDED package trips are a free marketing perk — they must never
 * add to the customer's total. `package_price` is retained on the trip row
 * for historical/reporting purposes only and is intentionally not read here.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- keeps the TripPriceInput call-site shape stable
export function includedTripCost(_trip: TripPriceInput): number {
  return 0
}

/** Extra (customer-added) trips are always charged at the normal public price. */
export function extraTripCost(trip: TripPriceInput): number {
  return Number(trip.price) || 0
}

// ─── Trip Package pricing ───
//
// A Trip Package (a curated bundle of existing Sinai Trips) is priced as
// SUM(package_price) of its included trips — NEVER falls back to `price`.
// A trip missing a valid package_price makes the whole package invalid
// (unpublishable in admin, unbookable on the public site). This is a
// distinct pricing path from the free Dahab-package included trips above:
// Trip Packages are always charged in full, never free.

export interface PackageTotals {
  /** SUM(price) of the included trips — what booking them individually would cost. */
  publicTotal: number
  /** SUM(package_price) of the included trips — the only value a customer is ever charged. */
  packageTotal: number
  savings: number
  /** false when any included trip is missing a valid (> 0) package_price, or there are no trips. */
  isValid: boolean
}

export function computePackageTotals(trips: { price: number; package_price?: number | null }[]): PackageTotals {
  if (trips.length === 0) return { publicTotal: 0, packageTotal: 0, savings: 0, isValid: false }
  let publicTotal = 0
  let packageTotal = 0
  let isValid = true
  for (const t of trips) {
    publicTotal += Number(t.price) || 0
    const pkg = Number(t.package_price)
    if (!Number.isFinite(pkg) || pkg <= 0) {
      isValid = false
    } else {
      packageTotal += pkg
    }
  }
  return { publicTotal, packageTotal, savings: Math.max(0, publicTotal - packageTotal), isValid }
}

/**
 * Authoritative duplicate-protection + pricing check, run server-side on
 * every booking/quote request — never trust the client's selection.
 * Rejects (does not silently resolve) any overlap: individual trip vs
 * package, or package vs package sharing a trip.
 */
export function validateAndPriceTripPackages(
  packages: { id: string; name_en: string; totals?: PackageTotals; trips?: { id: string; name_en: string }[] }[],
  extraTripIds: string[],
): { subtotal: number; error: string | null } {
  for (const p of packages) {
    if (!p.totals?.isValid) {
      return { subtotal: 0, error: `Trip package "${p.name_en}" is not currently bookable.` }
    }
  }
  const tripToPackage = new Map<string, string>()
  for (const p of packages) {
    for (const t of p.trips || []) {
      if (tripToPackage.has(t.id)) {
        return { subtotal: 0, error: `Trip "${t.name_en}" appears in more than one selected Trip Package.` }
      }
      tripToPackage.set(t.id, p.name_en)
    }
  }
  for (const id of extraTripIds) {
    if (tripToPackage.has(id)) {
      return { subtotal: 0, error: `A selected trip is already included in a selected Trip Package.` }
    }
  }
  const subtotal = packages.reduce((sum, p) => sum + (p.totals?.packageTotal ?? 0), 0)
  return { subtotal, error: null }
}

/** 4-day package = 3 nights, 5-day package = 4 nights. */
export function nightsForDuration(duration: 4 | 5): number {
  return duration === 5 ? 4 : 3
}

export interface AccommodationPackageQuoteInput {
  pricing: TransferPricing
  accommodation: RoomPriceInput
  roomType: RoomType
  /** Per-person, per-night add-on for the meal plan the customer picked (0 if none). */
  mealPlanPricePerNight: number
  nights: number
  /** Sum of the prices of the trips bundled into every package by default ("x"). */
  includedTripsTotal: number
  /** Sum of the prices of any extra trips the customer added, per person (pre-multiply). */
  extraTripsTotal: number
  transferType: TransferType
  governorateCode?: string | null
  direction: TransferDirection
  numPeople: number
}

export interface AccommodationPackageQuote {
  /** Per-person per-night room cost (before multiplying by nights). */
  roomPerPersonPerNight: number
  /** roomPerPersonPerNight × nights — total room cost per person. */
  roomPerPerson: number
  mealPlanTotal: number
  includedTripsTotal: number
  transfer: TransferQuote
  /** Everything above, per person, before extra (non-default) trips. */
  perPersonBeforeExtras: number
  extraTripsTotal: number
  numPeople: number
  total: number
}

export function quoteAccommodationPackage({
  pricing,
  accommodation,
  roomType,
  mealPlanPricePerNight,
  nights,
  includedTripsTotal,
  extraTripsTotal,
  transferType,
  governorateCode,
  direction,
  numPeople,
}: AccommodationPackageQuoteInput): AccommodationPackageQuote {
  const transfer = quoteTransfer({ pricing, type: transferType, governorateCode, direction, numPeople })
  const n = Math.max(0, nights)
  const roomPerPersonPerNight = roomPerPersonPrice(accommodation, roomType)
  // room cost per person = per-night price × number of nights
  const roomPerPerson = roomPerPersonPerNight * n
  const mealPlanTotal = (Number(mealPlanPricePerNight) || 0) * n
  const included = Number(includedTripsTotal) || 0
  const extras = Number(extraTripsTotal) || 0
  const perPersonBeforeExtras = roomPerPerson + mealPlanTotal + included + transfer.perPerson
  const people = transfer.numPeople

  return {
    roomPerPersonPerNight,
    roomPerPerson,
    mealPlanTotal,
    includedTripsTotal: included,
    transfer,
    perPersonBeforeExtras,
    extraTripsTotal: extras,
    numPeople: people,
    total: perPersonBeforeExtras * people + extras * people,
  }
}

// ─── Package quote v2 — seasonal, room-level, snapshot-backed ───
//
// The financially correct formula from the WEEMAP spec:
//
//   Accommodation subtotal   sum of applicable nightly TOTAL room rates × rooms
// + Transfer subtotal        selected transfer per-person rate × travelers
// + Included-trip subtotal   2 included trips at their PACKAGE cost × travelers
// + Meal subtotal            meal price / person / night × travelers × nights
// + Extra-trip subtotal      extra trips at PUBLIC price × travelers
// ─────────────────────────
// = Booking total
//
// The per-person display value is derived (total / travelers) — the engine
// itself always reasons from the total room price.

export interface PackageQuoteV2Input {
  pricing: TransferPricing
  accommodation: RoomPriceInput
  roomType: RoomType
  /** Check-in date — needed to resolve each night against seasonal periods. */
  checkIn: Date | string
  nights: number
  numRooms?: number
  /** Per-person, per-night meal add-on (0 if none picked). */
  mealPlanPricePerNight: number
  mealPlanKey?: string
  /** The two (or however many) trips bundled into the package. */
  includedTrips: TripPriceInput[]
  /** Extra trips the customer added on top. */
  extraTrips: TripPriceInput[]
  transferType: TransferType
  governorateCode?: string | null
  direction: TransferDirection
  numPeople: number
}

export interface PackageQuoteV2 {
  nightly: ResolvedNight[]
  nights: number
  numRooms: number
  accommodationSubtotal: number
  transfer: TransferQuote
  transferSubtotal: number
  includedTripsSubtotal: number
  mealSubtotal: number
  extraTripsSubtotal: number
  numPeople: number
  total: number
  /** total / numPeople — display only. */
  perPerson: number
}

export function quotePackageV2(input: PackageQuoteV2Input): PackageQuoteV2 {
  const people = Math.max(1, Math.floor(input.numPeople) || 1)
  const rooms = Math.max(1, Math.floor(input.numRooms ?? 1) || 1)
  const nights = Math.max(0, Math.floor(input.nights) || 0)

  const nightly = resolveNightlyRates(input.accommodation, input.roomType, input.checkIn, nights)
  const accSubtotal = accommodationSubtotal(nightly, rooms)

  const transfer = quoteTransfer({
    pricing: input.pricing,
    type: input.transferType,
    governorateCode: input.governorateCode,
    direction: input.direction,
    numPeople: people,
  })
  const transferSubtotal = transfer.perPerson * people

  const includedTripsSubtotal =
    input.includedTrips.reduce((s, t) => s + includedTripCost(t), 0) * people
  const extraTripsSubtotal =
    input.extraTrips.reduce((s, t) => s + extraTripCost(t), 0) * people
  const mealSubtotal = (Number(input.mealPlanPricePerNight) || 0) * nights * people

  const total = accSubtotal + transferSubtotal + includedTripsSubtotal + mealSubtotal + extraTripsSubtotal

  return {
    nightly,
    nights,
    numRooms: rooms,
    accommodationSubtotal: accSubtotal,
    transfer,
    transferSubtotal,
    includedTripsSubtotal,
    mealSubtotal,
    extraTripsSubtotal,
    numPeople: people,
    total,
    perPerson: people > 0 ? total / people : total,
  }
}

/**
 * Freeze everything that went into a quote so the booking row stores the
 * exact rates used. Changing hotel/trip/transfer prices later must NEVER
 * change a past booking — admins read this snapshot, not live prices.
 */
export function buildPriceSnapshot(
  input: PackageQuoteV2Input,
  quote: PackageQuoteV2,
): PriceSnapshot {
  return {
    room_type: input.roomType,
    num_rooms: quote.numRooms,
    nightly_room_rates: quote.nightly.map((n) => ({
      date: n.date,
      rate: n.rate,
      source: n.source,
      ...(n.seasonal_rate_name ? { seasonal_rate_name: n.seasonal_rate_name } : {}),
    })),
    nights: quote.nights,
    accommodation_subtotal: quote.accommodationSubtotal,
    transfer_rate_used: quote.transfer.perPerson,
    transfer_subtotal: quote.transferSubtotal,
    included_trips: input.includedTrips.map((t) => ({
      trip_id: t.id,
      name_en: t.name_en,
      package_cost: includedTripCost(t),
    })),
    included_trips_subtotal: quote.includedTripsSubtotal,
    ...(input.mealPlanKey ? { meal_plan_key: input.mealPlanKey } : {}),
    meal_plan_price_per_person_per_night: Number(input.mealPlanPricePerNight) || 0,
    meal_subtotal: quote.mealSubtotal,
    extra_trips: input.extraTrips.map((t) => ({
      trip_id: t.id,
      name_en: t.name_en,
      price: extraTripCost(t),
    })),
    extra_trips_subtotal: quote.extraTripsSubtotal,
    num_people: quote.numPeople,
    total: quote.total,
    computed_at: new Date().toISOString(),
  }
}

/** Stay-only snapshot: same idea, no transfer and no trips. */
export function buildStaySnapshot(
  acc: RoomPriceInput,
  roomType: RoomType,
  checkIn: Date | string,
  nights: number,
  mealPlanPricePerNight: number,
  numPeople: number,
  mealPlanKey?: string,
  numRooms?: number,
): { total: number; snapshot: PriceSnapshot } {
  const n = Math.max(1, Math.floor(nights) || 1)
  const people = Math.max(1, Math.floor(numPeople) || 1)
  const rooms = Math.max(1, Math.floor(numRooms ?? roomsForPeople(roomType, people)) || 1)
  const nightly = resolveNightlyRates(acc, roomType, checkIn, n)
  const accSubtotal = accommodationSubtotal(nightly, rooms)
  const mealSubtotal = (Number(mealPlanPricePerNight) || 0) * n * people
  const total = accSubtotal + mealSubtotal
  return {
    total,
    snapshot: {
      room_type: roomType,
      num_rooms: rooms,
      nightly_room_rates: nightly.map((x) => ({
        date: x.date, rate: x.rate, source: x.source,
        ...(x.seasonal_rate_name ? { seasonal_rate_name: x.seasonal_rate_name } : {}),
      })),
      nights: n,
      accommodation_subtotal: accSubtotal,
      ...(mealPlanKey ? { meal_plan_key: mealPlanKey } : {}),
      meal_plan_price_per_person_per_night: Number(mealPlanPricePerNight) || 0,
      meal_subtotal: mealSubtotal,
      num_people: people,
      total,
      computed_at: new Date().toISOString(),
    },
  }
}

// Keep the SinaiTrip type import in play for callers that pass whole trips.
export function toTripPriceInput(trip: SinaiTrip): TripPriceInput {
  return { id: trip.id, name_en: trip.name_en, price: trip.price, package_price: trip.package_price }
}

export interface StayQuoteInput {
  accommodation: RoomPriceInput
  roomType: RoomType
  checkIn: Date | string
  mealPlanPricePerNight: number
  nights: number
  numPeople: number
  numRooms?: number
}

export interface StayQuote {
  nightly: ResolvedNight[]
  accommodationSubtotal: number
  mealSubtotal: number
  numRooms: number
  nights: number
  numPeople: number
  total: number
}

/** Stay-only quote using the same nightly, room-level math as package pricing. */
export function quoteStay({
  accommodation, roomType, checkIn, mealPlanPricePerNight, nights, numPeople, numRooms,
}: StayQuoteInput): StayQuote {
  const n = Math.max(1, Math.floor(nights) || 1)
  const people = Math.max(1, Math.floor(numPeople) || 1)
  const rooms = Math.max(1, Math.floor(numRooms ?? roomsForPeople(roomType, people)) || 1)
  const nightly = resolveNightlyRates(accommodation, roomType, checkIn, n)
  const stayAccommodationSubtotal = accommodationSubtotal(nightly, rooms)
  const mealSubtotal = (Number(mealPlanPricePerNight) || 0) * n * people
  return {
    nightly,
    accommodationSubtotal: stayAccommodationSubtotal,
    mealSubtotal,
    numRooms: rooms,
    nights: n,
    numPeople: people,
    total: stayAccommodationSubtotal + mealSubtotal,
  }
}

// ─── Formatting ───

export function formatEGP(value: number, locale: string): string {
  // Delegates to the single formatting layer so money renders identically
  // everywhere. Display only — no value, rounding rule or calculation changes.
  //
  // For the two locales this app ships ('ar' and 'en') the output is
  // byte-identical to the previous inline implementation (Math.round, then
  // ar-EG / en-US grouping) — verified in format.test.ts.
  //
  // The one difference is on an unreachable path: an *unrecognised* locale
  // string used to fall back to en-US, and now falls back to the app's real
  // default locale, Arabic (routing.defaultLocale). `locale` here always comes
  // from next-intl's useLocale()/getLocale(), which only ever yields 'ar' or
  // 'en', so no rendered price is affected.
  return formatAmount(value, locale)
}
