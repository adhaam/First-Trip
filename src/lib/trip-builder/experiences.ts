/**
 * Pure helpers for the Experiences step (Section 6): deriving the category
 * chip row from the catalog's trips and filtering by the selected one. Kept
 * out of the component so the filtering logic — "which trips show for this
 * chip" — is unit-testable without React.
 */
import type { BuilderState, CatalogPackage, CatalogTrip } from './types'

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

// ─── Duplicate-charge prevention ────────────────────────────────────────────
// The server already drops a standalone trip that a selected package covers
// (normalizeExperienceSelections) and rejects package-vs-package overlap
// (validateAndPriceTripPackages). These helpers mirror that on the client so
// the customer sees it happen instead of discovering it at quote time.

export type ExperienceSelections = NonNullable<BuilderState['experiences']>

function selectedIds(experiences: ExperienceSelections | undefined, kind: 'trip' | 'trip_package'): Set<string> {
  return new Set((experiences ?? []).filter((item) => item.kind === kind).map((item) => item.id))
}

/** Catalog packages the customer currently has selected. */
export function selectedPackagesOf(packages: readonly CatalogPackage[], experiences: ExperienceSelections | undefined): CatalogPackage[] {
  const ids = selectedIds(experiences, 'trip_package')
  return packages.filter((pkg) => ids.has(pkg.id))
}

/** The selected package (if any) that already includes this trip. */
export function selectedPackageCovering(
  tripId: string,
  packages: readonly CatalogPackage[],
  experiences: ExperienceSelections | undefined,
): CatalogPackage | undefined {
  return selectedPackagesOf(packages, experiences).find((pkg) => pkg.trip_ids.includes(tripId))
}

/** Standalone trips currently selected that `pkg` would make redundant. */
export function standaloneTripsCoveredBy(
  pkg: Pick<CatalogPackage, 'trip_ids'>,
  trips: readonly CatalogTrip[],
  experiences: ExperienceSelections | undefined,
): CatalogTrip[] {
  const standalone = selectedIds(experiences, 'trip')
  const covered = new Set(pkg.trip_ids)
  return trips.filter((trip) => standalone.has(trip.id) && covered.has(trip.id))
}

/** Every selected standalone trip already covered by some selected package (for repairing old drafts). */
export function redundantStandaloneTrips(
  packages: readonly CatalogPackage[],
  trips: readonly CatalogTrip[],
  experiences: ExperienceSelections | undefined,
): CatalogTrip[] {
  const selected = selectedPackagesOf(packages, experiences)
  if (!selected.length) return []
  const covered = new Set(selected.flatMap((pkg) => pkg.trip_ids))
  const standalone = selectedIds(experiences, 'trip')
  return trips.filter((trip) => standalone.has(trip.id) && covered.has(trip.id))
}

/** Other selected packages that share at least one trip with `pkg` — the quote engine rejects that combination. */
export function conflictingSelectedPackages(
  pkg: Pick<CatalogPackage, 'id' | 'trip_ids'>,
  packages: readonly CatalogPackage[],
  experiences: ExperienceSelections | undefined,
): CatalogPackage[] {
  const mine = new Set(pkg.trip_ids)
  return selectedPackagesOf(packages, experiences).filter((other) => other.id !== pkg.id && other.trip_ids.some((id) => mine.has(id)))
}

export type PackageTogglePlan =
  | { mode: 'remove' }
  | { mode: 'add'; removedTrips: CatalogTrip[]; blockedBy: CatalogPackage[] }

/**
 * What toggling `pkg` does: removing is always allowed; adding is blocked while
 * another selected package overlaps it, and otherwise lists the standalone
 * trips that must be dropped so nothing is charged twice.
 */
export function planPackageToggle(
  pkg: CatalogPackage,
  packages: readonly CatalogPackage[],
  trips: readonly CatalogTrip[],
  experiences: ExperienceSelections | undefined,
): PackageTogglePlan {
  if (selectedIds(experiences, 'trip_package').has(pkg.id)) return { mode: 'remove' }
  return {
    mode: 'add',
    removedTrips: standaloneTripsCoveredBy(pkg, trips, experiences),
    blockedBy: conflictingSelectedPackages(pkg, packages, experiences),
  }
}
