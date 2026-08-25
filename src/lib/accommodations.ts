import type { Accommodation } from '@/lib/types'
import { slugifyTripName } from '@/lib/trips'

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_AT_END = new RegExp(`(${UUID_PATTERN})$`, 'i')

/**
 * Human-readable route without a schema migration — mirrors
 * `getTripRouteSlug` in `@/lib/trips`. The UUID suffix stays authoritative
 * so a rename never breaks an existing link; only the readable prefix
 * changes when the admin renames the property.
 */
export function getAccommodationRouteSlug(acc: Pick<Accommodation, 'id' | 'name_en'>): string {
  const name = slugifyTripName(acc.name_en || '') || 'stay'
  return `${name}-${acc.id}`
}

/** Supports both the new name-id route and an existing plain UUID link. */
export function getAccommodationIdFromRouteSlug(slug: string): string | null {
  return slug.match(UUID_AT_END)?.[1]?.toLowerCase() || null
}
