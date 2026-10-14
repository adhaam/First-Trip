// ─── Price-aware room allocation — pure helpers ───
//
// The SERVER picks the lowest-priced valid room combination for a party, using
// only room types that have a real, authoritative rate configured. No invented
// rates: a missing triple rate is NOT derived from the double rate here (the
// legacy `baseNightlyRoomRate` fallback is deliberately not used). A type that
// cannot be priced for every night of the stay is simply "not offered".
//
// No server imports — usable from the quote engine and from tests alike.

import { seasonalPriceForRoom, seasonalRateFor, toDate, toISODate } from './pricing'
import type { RoomPriceInput, RoomType } from './pricing'

export const ROOM_TYPES = ['single', 'double', 'triple'] as const

export const ROOM_CAPACITY: Record<RoomType, number> = { single: 1, double: 2, triple: 3 }

/** Matches `roomAllocationSchema` (count max 20). */
const MAX_COUNT_PER_TYPE = 20

export interface RoomAllocation {
  type: RoomType
  count: number
}

export interface RoomTypeOption {
  type: RoomType
  capacity: number
  /** True when every night of the stay has a real (> 0) rate for this type. */
  available: boolean
  /** One room, whole stay, including the per-room upgrade supplement. Null when unavailable. */
  stay_total_per_room: number | null
}

export interface RoomRecommendation {
  allocations: RoomAllocation[]
  accommodation_total: number
  rooms: number
  capacity: number
}

export interface RoomPlan {
  mode: 'recommended' | 'custom'
  people: number
  allocations: RoomAllocation[]
  /** Rooms incl. upgrade, for the priced allocations. */
  accommodation_total: number
  recommended: { allocations: RoomAllocation[]; accommodation_total: number } | null
  /** accommodation_total - recommended.accommodation_total (0 when there is no recommendation). */
  difference: number
  room_types: RoomTypeOption[]
}

export type RoomAllocationErrorCode =
  | 'ROOM_TYPE_UNAVAILABLE'
  | 'ROOM_CAPACITY_EXCEEDED'
  | 'ROOMS_EXCEED_GUESTS'

/** The raw base column for a type — never a derived/invented fallback. */
export function baseColumnRate(acc: RoomPriceInput, type: RoomType): number {
  if (type === 'single') return Number(acc.price_single_room) || 0
  if (type === 'triple') return Number(acc.price_triple_room) || 0
  return Number(acc.price_double_room) || 0
}

/**
 * Per-night TOTAL room rate for one room of `type`, or null when any night of
 * the stay has no real rate. A night's rate is the active seasonal price for
 * that type when > 0, otherwise the base column. Same date matching as
 * `resolveNightlyRates` (shared helpers from pricing.ts).
 */
export function authoritativeNightlyRates(
  acc: RoomPriceInput,
  type: RoomType,
  checkIn: Date | string,
  nights: number,
): number[] | null {
  const n = Math.max(0, Math.floor(nights) || 0)
  if (n < 1) return null
  const base = baseColumnRate(acc, type)
  const cursor = toDate(checkIn)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const seasonal = seasonalRateFor(acc.seasonal_rates, toISODate(cursor))
    const seasonalPrice = seasonal ? seasonalPriceForRoom(seasonal, type) : 0
    const rate = seasonal && seasonalPrice > 0 ? seasonalPrice : base
    if (!Number.isFinite(rate) || rate <= 0) return null
    out.push(rate)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/**
 * Every room type with its availability and whole-stay price per room.
 * `upgradeExtraPerNight` is a fixed supplement per ROOM per night.
 */
export function roomTypeOptions(
  acc: RoomPriceInput,
  checkIn: Date | string,
  nights: number,
  upgradeExtraPerNight = 0,
): RoomTypeOption[] {
  const n = Math.max(0, Math.floor(nights) || 0)
  const extra = Number(upgradeExtraPerNight) || 0
  return ROOM_TYPES.map((type) => {
    const rates = authoritativeNightlyRates(acc, type, checkIn, n)
    if (!rates) return { type, capacity: ROOM_CAPACITY[type], available: false, stay_total_per_room: null }
    const stay = rates.reduce((sum, rate) => sum + rate, 0) + extra * n
    return { type, capacity: ROOM_CAPACITY[type], available: true, stay_total_per_room: stay }
  })
}

function optionFor(options: RoomTypeOption[], type: RoomType): RoomTypeOption | undefined {
  return options.find((option) => option.type === type)
}

/** Total for the allocations, or null when any allocated type is unavailable. */
export function allocationCost(allocations: RoomAllocation[], options: RoomTypeOption[]): number | null {
  let total = 0
  for (const allocation of allocations) {
    const option = optionFor(options, allocation.type)
    if (!option?.available || option.stay_total_per_room == null) return null
    total += option.stay_total_per_room * allocation.count
  }
  return total
}

const cents = (value: number): number => Math.round(value * 100)

/**
 * The cheapest valid combination of rooms for `people`:
 *   capacity >= people, rooms <= people (an empty room is never sold),
 *   and minimal (dropping any one room would leave someone without a bed).
 * Ties: fewer rooms, then less spare capacity, then larger room types first.
 */
export function recommendRooms(people: number, options: RoomTypeOption[]): RoomRecommendation | null {
  const party = Math.floor(people)
  if (!Number.isFinite(party) || party < 1) return null
  const priced = (type: RoomType): number | null => {
    const option = optionFor(options, type)
    return option?.available && option.stay_total_per_room != null ? option.stay_total_per_room : null
  }
  const singlePrice = priced('single')
  const doublePrice = priced('double')
  const triplePrice = priced('triple')
  const maxCount = (price: number | null, capacity: number) =>
    price == null ? 0 : Math.min(MAX_COUNT_PER_TYPE, Math.ceil(party / capacity))

  let best: { s: number; d: number; t: number; total: number; rooms: number; spare: number } | null = null
  for (let t = maxCount(triplePrice, 3); t >= 0; t--) {
    for (let d = maxCount(doublePrice, 2); d >= 0; d--) {
      for (let s = maxCount(singlePrice, 1); s >= 0; s--) {
        const rooms = s + d + t
        const capacity = s + 2 * d + 3 * t
        if (rooms < 1 || capacity < party || rooms > party) continue
        // Minimal: removing any single room must leave capacity short.
        if (s > 0 && capacity - 1 >= party) continue
        if (d > 0 && capacity - 2 >= party) continue
        if (t > 0 && capacity - 3 >= party) continue
        const total = s * (singlePrice ?? 0) + d * (doublePrice ?? 0) + t * (triplePrice ?? 0)
        const candidate = { s, d, t, total, rooms, spare: capacity - party }
        if (!best) { best = candidate; continue }
        // Loops run from larger types down, so on a full tie the earlier
        // (larger-type-heavy) candidate is kept: only strictly better replaces.
        if (cents(candidate.total) !== cents(best.total)) {
          if (cents(candidate.total) < cents(best.total)) best = candidate
        } else if (candidate.rooms !== best.rooms) {
          if (candidate.rooms < best.rooms) best = candidate
        } else if (candidate.spare !== best.spare) {
          if (candidate.spare < best.spare) best = candidate
        }
      }
    }
  }
  if (!best) return null
  const allocations: RoomAllocation[] = []
  if (best.s > 0) allocations.push({ type: 'single', count: best.s })
  if (best.d > 0) allocations.push({ type: 'double', count: best.d })
  if (best.t > 0) allocations.push({ type: 'triple', count: best.t })
  return {
    allocations,
    accommodation_total: best.total,
    rooms: best.rooms,
    capacity: best.s + 2 * best.d + 3 * best.t,
  }
}

/** Server-side validation of customer-sent allocations. */
export function validateAllocations(
  people: number,
  allocations: RoomAllocation[],
  options: RoomTypeOption[],
): { ok: true } | { ok: false; code: RoomAllocationErrorCode } {
  for (const allocation of allocations) {
    const option = optionFor(options, allocation.type)
    if (!option?.available) return { ok: false, code: 'ROOM_TYPE_UNAVAILABLE' }
  }
  const capacity = allocations.reduce((sum, a) => sum + a.count * ROOM_CAPACITY[a.type], 0)
  if (capacity < people) return { ok: false, code: 'ROOM_CAPACITY_EXCEEDED' }
  const rooms = allocations.reduce((sum, a) => sum + a.count, 0)
  if (rooms > people) return { ok: false, code: 'ROOMS_EXCEED_GUESTS' }
  return { ok: true }
}
