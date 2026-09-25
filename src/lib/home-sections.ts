// ─── Home V2 — pure section-selection logic ───
//
// "Which items render, in which section" is a product decision, not a
// rendering detail — it lives here, unit-tested, so HomeClient's section
// components stay dumb (they receive an already-decided list and just draw
// it). Nothing in this file talks to Supabase, formats a string, or picks a
// locale; it only filters, sorts and groups data the server already fetched.
//
// Pricing math is never reimplemented here — effectiveTripPrice/
// roomPerPersonPrice (lib/pricing.ts) and paymentKindFor (lib/payment-rules.ts)
// are the single source of truth and are simply called.

import type { Accommodation, Experience, ExperienceDate, SinaiTrip, TripPackage } from './types'
import { effectiveTripPrice, roomPerPersonPrice, type RoomType } from './pricing'
import { paymentKindFor, type PaymentKind } from './payment-rules'
import { deriveTripCategoryChips, tripMatchesCategoryChip, type TripCategoryChip } from './trip-categories'

// ─── Curated / happening now ───

/**
 * Why a pick is on the "happening now" rail — drives which badge/eyebrow the
 * UI shows. `curated` only ever appears when nothing else qualified, and
 * always as the ONLY reason present (see `isFallbackCurated`) — the UI must
 * never claim a curated fallback pick is "on sale" or "featured".
 */
export type CuratedReason = 'featured' | 'discount' | 'signature-date' | 'curated'

export type CuratedPick =
  | { kind: 'trip'; id: string; trip: SinaiTrip; reason: CuratedReason }
  | { kind: 'package'; id: string; pkg: TripPackage; reason: CuratedReason }
  | { kind: 'experience-date'; id: string; experience: Experience; date: ExperienceDate; reason: CuratedReason }

export interface SelectCuratedPicksInput {
  trips: readonly SinaiTrip[]
  packages: readonly TripPackage[]
  experiences: readonly Experience[]
  /** Site Settings → Homepage → featured trip ids. Empty = no owner override. */
  featuredTripIds?: readonly string[]
  now?: Date
  limit?: number
}

/**
 * Open Signature Experience dates that haven't happened yet, soonest first.
 * A date is only "upcoming" when its own row says so (`status: 'open'` AND
 * `is_open`) and its start date is not in the past — never inferred from the
 * experience being published.
 */
export function selectUpcomingExperienceDates(
  experiences: readonly Experience[],
  now: Date = new Date(),
): { experience: Experience; date: ExperienceDate }[] {
  const nowTime = now.getTime()
  const out: { experience: Experience; date: ExperienceDate }[] = []
  for (const experience of experiences) {
    for (const date of experience.dates ?? []) {
      if (date.status !== 'open' || !date.is_open) continue
      const start = new Date(`${date.start_date}T00:00:00`).getTime()
      if (Number.isNaN(start) || start < nowTime) continue
      out.push({ experience, date })
    }
  }
  return out.sort((a, b) => a.date.start_date.localeCompare(b.date.start_date))
}

/**
 * The homepage's "Curated / happening now" rail. Honest by construction:
 * every non-fallback pick carries a real, checkable reason (owner-featured,
 * an active discount window, or a real upcoming date) — never a fabricated
 * "trending" or "X people viewing" claim. Only when NOTHING qualifies does it
 * fall back to a sort_order pick, and that fallback is tagged so the UI can
 * label it "Curated by WEEMAP" instead of pretending it is a live deal.
 */
export function selectCuratedPicks({
  trips,
  packages,
  experiences,
  featuredTripIds = [],
  now = new Date(),
  limit = 6,
}: SelectCuratedPicksInput): CuratedPick[] {
  const picks: CuratedPick[] = []
  const seen = new Set<string>()
  const add = (pick: CuratedPick) => {
    const key = `${pick.kind}:${pick.id}`
    if (seen.has(key)) return
    seen.add(key)
    picks.push(pick)
  }

  for (const pkg of packages) {
    if (pkg.featured) add({ kind: 'package', id: pkg.id, pkg, reason: 'featured' })
  }
  for (const trip of trips) {
    if (featuredTripIds.includes(trip.id)) add({ kind: 'trip', id: trip.id, trip, reason: 'featured' })
  }
  for (const trip of trips) {
    if (effectiveTripPrice(trip, now).isDiscounted) add({ kind: 'trip', id: trip.id, trip, reason: 'discount' })
  }
  for (const { experience, date } of selectUpcomingExperienceDates(experiences, now)) {
    add({ kind: 'experience-date', id: `${experience.id}:${date.id}`, experience, date, reason: 'signature-date' })
  }

  if (picks.length === 0) {
    return [...trips]
      .sort((a, b) => a.sort_order - b.sort_order)
      .slice(0, limit)
      .map((trip): CuratedPick => ({ kind: 'trip', id: trip.id, trip, reason: 'curated' }))
  }

  return picks.slice(0, limit)
}

/** True when every pick came from the sort_order fallback (or the list is empty). */
export function isFallbackCurated(picks: readonly CuratedPick[]): boolean {
  return picks.every((pick) => pick.reason === 'curated')
}

// ─── Packages — two distinct lanes ───

export interface PackageLanes {
  /** payment_kind 'stay_package' — stay-centred, 50/50. */
  stayPackages: TripPackage[]
  /** payment_kind 'experience_package' (or unset) — 100% after confirmation. */
  experiencePackages: TripPackage[]
}

/** Resolves a package's payment kind through the same canonical resolver every other surface uses. */
export function packageLaneKind(pkg: Pick<TripPackage, 'id' | 'payment_kind'>): PaymentKind {
  return paymentKindFor({ payment_kind: pkg.payment_kind, trip_package_id: pkg.id })
}

export function splitPackageLanes(packages: readonly TripPackage[]): PackageLanes {
  const stayPackages: TripPackage[] = []
  const experiencePackages: TripPackage[] = []
  for (const pkg of packages) {
    if (packageLaneKind(pkg) === 'stay_package') stayPackages.push(pkg)
    else experiencePackages.push(pkg)
  }
  return { stayPackages, experiencePackages }
}

// ─── Explore Sinai — category tiles ───

export interface CategoryTile {
  chip: TripCategoryChip
  /** First image from a trip that carries this category; null when none has one. */
  image: string | null
}

/** One representative image per taxonomy chip, in the taxonomy's own display order. */
export function selectCategoryTiles(trips: readonly SinaiTrip[], limit = 6): CategoryTile[] {
  const chips = deriveTripCategoryChips(trips)
  return chips.slice(0, limit).map((chip) => {
    const match = trips.find((trip) => tripMatchesCategoryChip(trip, chip.id) && (trip.images?.length ?? 0) > 0)
    return { chip, image: match?.images?.[0] ?? null }
  })
}

// ─── Stays — one hero + secondaries ───

export interface StaysLineup {
  hero: Accommodation | null
  secondaries: Accommodation[]
}

/**
 * Owner-featured accommodations first (Site Settings → Homepage); falls back
 * to every active accommodation when there's no override, and ALSO falls back
 * when the configured ids no longer match anything live (a stale id list must
 * never empty out the whole section).
 */
export function selectStaysLineup(
  accommodations: readonly Accommodation[],
  featuredAccommodationIds: readonly string[] = [],
  limit = 4,
): StaysLineup {
  const featuredPool = featuredAccommodationIds.length
    ? accommodations.filter((a) => featuredAccommodationIds.includes(a.id))
    : []
  const pool = featuredPool.length ? featuredPool : accommodations
  const [hero, ...rest] = pool
  return { hero: hero ?? null, secondaries: rest.slice(0, Math.max(0, limit - 1)) }
}

/**
 * Display-only "from" price per person per night — the cheapest configured
 * room type. Never reimplements the room-pricing formula: delegates to
 * `roomPerPersonPrice` (lib/pricing.ts), the same function booking flows use.
 */
export function stayFromPricePerPersonPerNight(acc: {
  price_double_room: number
  price_single_room: number
  price_triple_room?: number
}): number {
  const types: RoomType[] = ['double', 'single', 'triple']
  const prices = types
    .map((type) => roomPerPersonPrice(acc, type))
    .filter((price) => Number.isFinite(price) && price > 0)
  return prices.length ? Math.min(...prices) : 0
}

// ─── Shop & Rent — only when there's real inventory ───

export interface ShopRentVisibility {
  showShop: boolean
  showRent: boolean
}

/** A lane only renders when it has active inventory — never an empty grid. */
export function selectShopRentVisibility(merchProductCount: number, rentalProductCount: number): ShopRentVisibility {
  return { showShop: merchProductCount > 0, showRent: rentalProductCount > 0 }
}
