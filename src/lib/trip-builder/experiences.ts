/**
 * Pure helpers for the Experiences step (Section 6): deriving the category
 * chip row from the catalog's trips and filtering by the selected one. Kept
 * out of the component so the filtering logic — "which trips show for this
 * chip" — is unit-testable without React.
 */
import type { CatalogTrip } from './types'

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
