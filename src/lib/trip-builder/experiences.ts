/**
 * Pure helpers for the Experiences step (Section 6): deriving the category
 * chip row from the catalog's trips and filtering by the selected one. Kept
 * out of the component so the filtering logic — "which trips show for this
 * chip" — is unit-testable without React.
 */
import type { CatalogPackage, CatalogTrip } from './types'

export type TripCategory = { slug: string; name_ar: string; name_en: string }

/** Unique categories across every trip, in first-seen order (stable, data-driven — never a fixed list). */
export function tripCategories(trips: readonly CatalogTrip[]): TripCategory[] {
  const seen = new Map<string, TripCategory>()
  for (const trip of trips) {
    trip.category_slugs.forEach((slug, index) => {
      if (seen.has(slug)) return
      const label = trip.category_labels[index]
      if (label) seen.set(slug, { slug, name_ar: label.ar, name_en: label.en })
    })
  }
  return [...seen.values()]
}

/** `category` of `null` (or one that matches nothing) means "show everything". */
export function filterTripsByCategory(trips: readonly CatalogTrip[], category: string | null): CatalogTrip[] {
  if (!category) return [...trips]
  return trips.filter((trip) => trip.category_slugs.includes(category))
}

export type PackageIncludedSummary = { names: string[]; extra: number }

/**
 * A compact "what's inside" line for a package card, e.g.
 * `{ names: ['Blue Hole', 'Yacht', 'Sunset Safari'], extra: 2 }` →
 * "Blue Hole · Yacht · Sunset Safari +2". Derived only from the package's
 * real `trip_ids` (already sort-ordered by `getTripPackages`) matched
 * against the catalog's real trips — an id that no longer resolves to a
 * catalog trip is silently skipped rather than shown as a blank entry.
 */
export function packageIncludedSummary(
  pkg: Pick<CatalogPackage, 'trip_ids'>,
  trips: readonly CatalogTrip[],
  locale: 'ar' | 'en',
  max = 3,
): PackageIncludedSummary {
  const byId = new Map(trips.map((trip) => [trip.id, trip]))
  const matched = pkg.trip_ids.map((id) => byId.get(id)).filter((trip): trip is CatalogTrip => Boolean(trip))
  const names = matched.slice(0, max).map((trip) => (locale === 'ar' ? trip.name_ar : trip.name_en))
  return { names, extra: Math.max(0, matched.length - max) }
}
