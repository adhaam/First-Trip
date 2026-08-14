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

import type {
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

export type RoomType = 'double' | 'single'

export interface RoomPriceInput {
  price_double_room: number
  price_single_room: number
}

/** Double/triple: half the room price (2 people share it). Single: paid in full. */
export function roomPerPersonPrice(acc: RoomPriceInput, roomType: RoomType): number {
  if (roomType === 'single') return Number(acc.price_single_room) || 0
  return (Number(acc.price_double_room) || 0) / 2
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

export interface StayQuoteInput {
  accommodation: RoomPriceInput
  roomType: RoomType
  mealPlanPricePerNight: number
  nights: number
  numPeople: number
}

export interface StayQuote {
  roomPerPerson: number
  perNightPerPerson: number
  nights: number
  numPeople: number
  total: number
}

/** Stay-only: same room + meal-plan math, no transfer, no trips. */
export function quoteStay({
  accommodation, roomType, mealPlanPricePerNight, nights, numPeople,
}: StayQuoteInput): StayQuote {
  const roomPerPerson = roomPerPersonPrice(accommodation, roomType)
  const perNightPerPerson = roomPerPerson + (Number(mealPlanPricePerNight) || 0)
  const n = Math.max(1, Math.floor(nights) || 1)
  const people = Math.max(1, Math.floor(numPeople) || 1)
  return {
    roomPerPerson,
    perNightPerPerson,
    nights: n,
    numPeople: people,
    total: perNightPerPerson * n * people,
  }
}

// ─── Formatting ───

export function formatEGP(value: number, locale: string): string {
  const n = Math.round(value)
  return n.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')
}
