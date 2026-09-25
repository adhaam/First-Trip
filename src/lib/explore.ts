// ─── Explore surface logic — pure, server- and client-safe ───
//
// Category-chip URL matching and the trip↔package cross-sell relationship
// live here so /explore, /sinai-trips and /sinai-trips/packages (and anyone
// linking into them) share exactly one definition of each — see
// src/lib/explore.test.ts.
//
// There is no package "lane" here: a trip_package is always one public
// product, a Sinai trip package (see docs/m2/BRIEF.md "Package semantics").
// `payment_kind` on a package is being narrowed to always be
// 'experience_package' (migration 034) and is never read here to classify
// a package for display.

import { tripMatchesCategoryChip } from './trip-categories'
import type { SinaiTrip, TripCategory, TripPackage } from './types'

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
 * Packages that genuinely include a given trip — a real, data-backed
 * relationship read straight off `trip_package_items` (never inferred; see
 * "Never invent... relationships" in docs/m2/BRIEF.md). Powers the trip
 * detail page's "also in these packages" cross-sell.
 */
export function packagesIncludingTrip(packages: readonly TripPackage[], tripId: string): TripPackage[] {
  return packages.filter((pkg) => pkg.trips?.some((trip) => trip.id === tripId))
}
