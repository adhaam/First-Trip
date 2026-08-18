import type { SinaiTrip } from '@/lib/types'

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const UUID_AT_END = new RegExp(`(${UUID_PATTERN})$`, 'i')

export function slugifyTripName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72)
}

/**
 * Human-readable route without a schema migration. The UUID suffix remains
 * authoritative, so changing a display name never breaks record lookup.
 */
export function getTripRouteSlug(trip: Pick<SinaiTrip, 'id' | 'name_en'>): string {
  const name = slugifyTripName(trip.name_en || '') || 'sinai-trip'
  return `${name}-${trip.id}`
}

/** Supports both the new name-id route and an existing plain UUID link. */
export function getTripIdFromRouteSlug(slug: string): string | null {
  return slug.match(UUID_AT_END)?.[1]?.toLowerCase() || null
}
