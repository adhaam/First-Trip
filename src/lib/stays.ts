// ─── Stays V2 — pure display logic for /book-dahab and /book-dahab/[id] ───
//
// Nothing here fetches data or knows about Supabase; it only transforms
// Accommodation rows the server already loaded (see src/lib/data.ts). Keeping
// it pure means the filter/sort/pricing-row/amenity-grouping rules can be
// unit-tested without a database, and the two client components that need
// them (BookDahabClient, the stay detail sections) can never disagree about
// what "starting price" or "active meal plan" means.

import type { Accommodation, AccommodationType, MealPlan } from './types'

// ─── List filtering & sorting ───

export type StayFilterKey = 'all' | AccommodationType
export type StaySortKey = 'default' | 'price-asc' | 'price-desc'

const STAY_TYPES: AccommodationType[] = ['hotel', 'chalet', 'camp']

/**
 * The lowest configured room rate — what every card, the sort, and the
 * detail page's "from" price all read. Falls back to the legacy per-person
 * `price_per_night` only when no room rate is configured at all. Zero/blank
 * rates are excluded — an unset room type is not a real "from EGP 0" price.
 */
export function startingRoomRate(
  acc: Pick<Accommodation, 'price_single_room' | 'price_double_room' | 'price_triple_room' | 'price_per_night'>,
): number {
  const rates = [acc.price_single_room, acc.price_double_room, acc.price_triple_room]
    .map(Number)
    .filter((price) => price > 0)
  return rates.length ? Math.min(...rates) : Number(acc.price_per_night) || 0
}

export function filterAccommodationsByType(list: Accommodation[], filter: StayFilterKey): Accommodation[] {
  return filter === 'all' ? list : list.filter((acc) => acc.type === filter)
}

/** hotel/chalet/camp counts over the full (unfiltered) list — for chip badges. */
export function accommodationTypeCounts(list: Accommodation[]): Record<AccommodationType, number> {
  const counts: Record<AccommodationType, number> = { hotel: 0, chalet: 0, camp: 0 }
  for (const acc of list) {
    if (STAY_TYPES.includes(acc.type)) counts[acc.type] += 1
  }
  return counts
}

/**
 * Sorts by the same value the card displays (startingRoomRate), so "Price ↑"
 * is never contradicted by what the customer reads on the card. Missing/zero
 * prices always sort last, in both directions — they are not "the cheapest".
 * `default` preserves the server's own order (sort_order ASC).
 */
export function sortAccommodations(list: Accommodation[], sortBy: StaySortKey): Accommodation[] {
  if (sortBy === 'default') return [...list]
  return [...list].sort((a, b) => {
    const pa = startingRoomRate(a)
    const pb = startingRoomRate(b)
    if (pa === 0 && pb === 0) return 0
    if (pa === 0) return 1
    if (pb === 0) return -1
    return sortBy === 'price-asc' ? pa - pb : pb - pa
  })
}

// ─── Room rate rows (detail page pricing table) ───

export type RoomTypeKey = 'single' | 'double' | 'triple'

export interface RoomRateRow {
  type: RoomTypeKey
  /** What is actually charged for the room, per night. */
  pricePerRoom: number
  /** Occupants the room type is priced for. */
  occupancy: 1 | 2 | 3
  /** pricePerRoom / occupancy — single is already per-person. */
  pricePerPerson: number
}

const ROOM_OCCUPANCY: Record<RoomTypeKey, 1 | 2 | 3> = { single: 1, double: 2, triple: 3 }

/**
 * Only rows with a real, configured rate — an unset room type is not sold,
 * not "free". `price_single_room` is stored per-person already; double/triple
 * are stored per-room (see the field comments on the `Accommodation` type),
 * so per-person there is derived, never re-entered.
 */
export function roomRateRows(
  acc: Pick<Accommodation, 'price_single_room' | 'price_double_room' | 'price_triple_room'>,
): RoomRateRow[] {
  const rows: { type: RoomTypeKey; pricePerRoom: number }[] = [
    { type: 'single', pricePerRoom: Number(acc.price_single_room) || 0 },
    { type: 'double', pricePerRoom: Number(acc.price_double_room) || 0 },
    { type: 'triple', pricePerRoom: Number(acc.price_triple_room) || 0 },
  ]
  return rows
    .filter((row) => row.pricePerRoom > 0)
    .map((row) => ({
      ...row,
      occupancy: ROOM_OCCUPANCY[row.type],
      pricePerPerson: row.pricePerRoom / ROOM_OCCUPANCY[row.type],
    }))
}

// ─── Meal plans ───

/** Active meal plans, cheapest supplement first (room-only, usually 0, reads first). */
export function activeMealPlans(mealPlans: MealPlan[] | undefined): MealPlan[] {
  return (mealPlans ?? [])
    .filter((plan) => plan.is_active)
    .sort((a, b) => a.price_per_person_per_night - b.price_per_person_per_night)
}

// ─── Amenity grouping ───

export type AmenityGroupKey = 'water' | 'comfort' | 'food' | 'outdoor' | 'other'

const AMENITY_GROUP_ORDER: AmenityGroupKey[] = ['water', 'comfort', 'food', 'outdoor', 'other']

/**
 * Maps every ar/en spelling in AMENITIES_LIBRARY (src/lib/amenities.ts) to a
 * display group. Kept independent of that file's icon assignment — icons are
 * a per-item visual, groups are a layout decision — and anything not in the
 * library still renders under `other` rather than being silently dropped, in
 * case an accommodation ever carries a value outside the picker's list.
 */
const AMENITY_GROUP: Record<string, AmenityGroupKey> = {
  'حمام سباحة': 'water', 'Swimming Pool': 'water',
  'إطلالة على البحر': 'water', 'Sea View': 'water',
  'مباشرة على البحر': 'water', 'Beachfront': 'water',
  'حمام سباحة دافء': 'water', 'Heated Pool': 'water',
  'مركز غوص خاص': 'water', 'Private Dive Center': 'water',
  'شاطئ خاص': 'water', 'Private Beach': 'water',
  'واي فاي مجاني': 'comfort', 'Free WiFi': 'comfort',
  'تكييف': 'comfort', 'Air Conditioning': 'comfort',
  'جيم وسبا': 'comfort', 'Gym & Spa': 'comfort',
  'إفطار مجاني': 'food', 'Free Breakfast': 'food',
  'مطبخ مجهز': 'food', 'Equipped Kitchen': 'food',
  'شواية باربيكيو': 'food', 'BBQ Grill': 'food',
  'شاي بدوي مجاني': 'food', 'Free Bedouin Tea': 'food',
  'بوفيه مفتوح': 'food', 'Open Buffet': 'food',
  'حديقة خاصة': 'outdoor', 'Private Garden': 'outdoor',
  'جلسة بدوية': 'outdoor', 'Bedouin Seating': 'outdoor',
}

export interface AmenityGroup {
  key: AmenityGroupKey
  items: string[]
}

/**
 * Groups a locale-resolved amenity list (already `amenities_ar` OR
 * `amenities_en`, picked by the caller) for display. Empty groups are
 * omitted; the group order is fixed so the layout never reshuffles between
 * accommodations.
 */
export function groupAmenities(amenities: string[]): AmenityGroup[] {
  const buckets = new Map<AmenityGroupKey, string[]>()
  for (const amenity of amenities) {
    const key = AMENITY_GROUP[amenity] ?? 'other'
    const bucket = buckets.get(key) ?? []
    bucket.push(amenity)
    buckets.set(key, bucket)
  }
  return AMENITY_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    items: buckets.get(key) as string[],
  }))
}
