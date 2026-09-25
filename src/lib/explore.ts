// ─── Explore surface logic — pure, server- and client-safe ───
//
// Category-chip URL matching, package-lane classification, and the trip↔
// package cross-sell relationship all live here so /explore, /sinai-trips
// and /sinai-trips/packages (and anyone linking into them) share exactly one
// definition of each — see src/lib/explore.test.ts.

import { paymentKindFor } from './payment-rules'
import { tripMatchesCategoryChip } from './trip-categories'
import type { SinaiTrip, TripCategory, TripPackage } from './types'

export type PackageLane = 'stay' | 'experience'

/** Every resolved category a trip carries — its primary category plus its tags, deduplicated by id. */
function tripCategories(trip: SinaiTrip): TripCategory[] {
  const seen = new Set<string>()
  const categories: TripCategory[] = []
  for (const category of [trip.category, ...(trip.category_tags ?? [])]) {
    if (!category || seen.has(category.id)) continue
    seen.add(category.id)
    categories.push(category)
  }
  return categories
}

/**
 * Resolves a `?category=` value from the URL to the canonical structured
 * category id `tripMatchesCategoryChip` matches against — or `'all'` when
 * nothing among the currently visible trips matches.
 *
 * Accepts either a category's `id` (what our own chips link with) or its
 * `slug` (the friendlier value another surface — e.g. a Community post
 * linking "Explore hiking trips" — is more likely to hold). Both resolve to
 * the same trips; the id is what downstream `tripsForCategory` filtering
 * needs, so this is the one place that ever has to know both spellings
 * exist.
 */
export function categoryFromSearchParam(value: string | string[] | undefined, trips: readonly SinaiTrip[]): string {
  const candidate = typeof value === 'string' ? value : ''
  if (!candidate) return 'all'
  for (const trip of trips) {
    for (const category of tripCategories(trip)) {
      if (category.id === candidate || category.slug === candidate) return category.id
    }
  }
  return 'all'
}

export function tripsForCategory(trips: readonly SinaiTrip[], categoryId: string): SinaiTrip[] {
  return categoryId === 'all' ? [...trips] : trips.filter((trip) => tripMatchesCategoryChip(trip, categoryId))
}

/**
 * Resolves which display lane a package belongs to, from its authoritative
 * `payment_kind` (see `paymentKindFor` — the M1 default for a package with no
 * stored kind is `'experience_package'`). The single source both
 * `groupPackagesByLane` and the package cards use, so a card can never
 * disagree with the lane it is rendered inside.
 */
export function packageLane(pkg: Pick<TripPackage, 'id' | 'payment_kind'>): PackageLane {
  const kind = paymentKindFor({ trip_package_id: pkg.id, trip_package_payment_kind: pkg.payment_kind })
  return kind === 'stay_package' ? 'stay' : 'experience'
}

export function groupPackagesByLane(packages: readonly TripPackage[]): Record<PackageLane, TripPackage[]> {
  const groups: Record<PackageLane, TripPackage[]> = { stay: [], experience: [] }
  for (const pkg of packages) groups[packageLane(pkg)].push(pkg)
  return groups
}

/**
 * Packages that genuinely include a given trip — a real, data-backed
 * relationship read straight off `trip_package_items` (never inferred; see
 * "Never invent... relationships" in docs/m2/BRIEF.md). Powers the trip
 * detail page's "also in these packages" cross-sell.
 */
export function packagesIncludingTrip(packages: readonly TripPackage[], tripId: string): TripPackage[] {
  return packages.filter((pkg) => pkg.trips?.some((trip) => trip.id === tripId))
}
