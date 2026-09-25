import type { ResolvedTripCategory, SinaiTrip, TripCategory } from './types'

type CategoryTrip = Pick<SinaiTrip, 'id' | 'trip_category_id' | 'category_ar' | 'category_en'>

export interface SinaiTripCategoryTag {
  trip_id: string
  category_id: string
}

export type TripCategoryChip = ResolvedTripCategory

/** Resolve the active structured primary category, retaining legacy text only as a compatibility fallback. */
export function resolveTripCategory(
  trip: CategoryTrip,
  categoriesById: ReadonlyMap<string, TripCategory>,
): ResolvedTripCategory | null {
  const structured = trip.trip_category_id ? categoriesById.get(trip.trip_category_id) : undefined
  if (structured?.is_active) return { ...structured, source: 'structured' }

  if (!trip.category_ar && !trip.category_en) return null
  const label = trip.category_en || trip.category_ar
  return {
    id: `legacy:${trip.category_ar}\u0000${trip.category_en}`,
    slug: `legacy:${label}`,
    name_ar: trip.category_ar,
    name_en: trip.category_en,
    is_active: true,
    sort_order: Number.MAX_SAFE_INTEGER,
    source: 'legacy',
  }
}

/** Return active structured tags only, always placing the resolved primary category first. */
export function tripCategoryTags(
  trip: CategoryTrip,
  tags: readonly SinaiTripCategoryTag[],
  categoriesById: ReadonlyMap<string, TripCategory>,
): TripCategory[] {
  const ids = [trip.trip_category_id, ...tags.filter((tag) => tag.trip_id === trip.id).map((tag) => tag.category_id)]
  const seen = new Set<string>()
  const categories: TripCategory[] = []
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    const category = categoriesById.get(id)
    if (category?.is_active) categories.push(category)
  }
  return categories
}

/**
 * Derive listing chips from visible trips. Structured categories are sorted by
 * their configured order; legacy chips appear only for trips without one.
 */
export function deriveTripCategoryChips(trips: readonly SinaiTrip[]): TripCategoryChip[] {
  const structured = new Map<string, TripCategoryChip>()
  const legacy = new Map<string, TripCategoryChip>()

  for (const trip of trips) {
    const primary = trip.category
    if (primary?.source === 'structured') {
      structured.set(primary.id, primary)
    } else if (primary?.source === 'legacy') {
      legacy.set(primary.id, primary)
    }
  }

  return [
    ...[...structured.values()].sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en)),
    ...legacy.values(),
  ]
}

/** A listing chip matches a trip's structured primary category or any structured tag. */
export function tripMatchesCategoryChip(trip: SinaiTrip, chipId: string): boolean {
  if (trip.category?.id === chipId) return true
  return trip.category_tags?.some((category) => category.id === chipId) ?? false
}

export interface TripCategoryTagSyncDiff {
  insertCategoryIds: string[]
  deleteCategoryIds: string[]
}

/** Compute the non-destructive tag replacement steps: insert additions before deleting removals. */
export function diffTripCategoryTags(
  existingCategoryIds: readonly string[],
  requestedCategoryIds: readonly string[],
  primaryCategoryId?: string | null,
): TripCategoryTagSyncDiff {
  const desired = new Set(requestedCategoryIds)
  if (primaryCategoryId) desired.add(primaryCategoryId)
  const existing = new Set(existingCategoryIds)
  return {
    insertCategoryIds: [...desired].filter((id) => !existing.has(id)),
    deleteCategoryIds: [...existing].filter((id) => !desired.has(id)),
  }
}

export function isMissingTripCategoryTagsTable(error: { code?: string | null; message?: string | null } | null | undefined): boolean {
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || Boolean(error?.message?.toLowerCase().includes('sinai_trip_category_tags'))
}
