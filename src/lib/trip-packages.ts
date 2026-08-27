import type { TripPackage, TripPackageTrip } from '@/lib/types'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { computePackageTotals } from '@/lib/pricing'

type TripPackageRow = TripPackage & {
  trip_package_items: { sort_order: number; sinai_trips: TripPackageTrip | null }[]
}

function mapItems(row: TripPackageRow): TripPackage {
  const trips = (row.trip_package_items || [])
    .filter((i) => i.sinai_trips)
    .map((i) => ({ ...(i.sinai_trips as TripPackageTrip), sort_order: i.sort_order }))
    .sort((a, b) => a.sort_order - b.sort_order)
  const { trip_package_items: _omit, ...rest } = row
  void _omit
  return { ...rest, trips }
}

/**
 * Computes the aggregate total from the real per-trip package_price values,
 * then strips package_price from every trip — the client only ever receives
 * the final total, never the per-trip breakdown.
 */
function toPublicPackage(pkg: TripPackage): TripPackage {
  const totals = computePackageTotals(pkg.trips || [])
  return { ...pkg, totals, trips: pkg.trips?.map((t) => ({ ...t, package_price: null })) }
}

// Select the trip's full images array and take [0] client-side — simpler and
// more robust than a Supabase column-rename alias for the cover image.
const PACKAGE_SELECT_SAFE = '*, trip_package_items(sort_order, sinai_trips(id, name_ar, name_en, images, price, package_price))'

function normalizeTripImage(row: TripPackageRow): TripPackageRow {
  return {
    ...row,
    trip_package_items: (row.trip_package_items || []).map((i) => ({
      ...i,
      sinai_trips: i.sinai_trips
        ? { ...i.sinai_trips, image: (i.sinai_trips as unknown as { images?: string[] }).images?.[0] || null }
        : null,
    })),
  }
}

/** Published packages only, trips included, package_price stripped for public consumption. */
export async function getTripPackages(): Promise<TripPackage[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_packages')
    .select(PACKAGE_SELECT_SAFE)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getTripPackages error:', error)
    return []
  }
  return ((data || []) as unknown as TripPackageRow[])
    .map(normalizeTripImage)
    .map(mapItems)
    .map(toPublicPackage)
    // Defense in depth: is_active is the publish gate, but if a trip's
    // package_price gets unset after publishing, never show a broken total.
    .filter((p) => p.totals?.isValid)
}

export async function getTripPackageBySlug(slug: string): Promise<TripPackage | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_packages')
    .select(PACKAGE_SELECT_SAFE)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) return null
  const pkg = toPublicPackage(mapItems(normalizeTripImage(data as unknown as TripPackageRow)))
  return pkg.totals?.isValid ? pkg : null
}

const PACKAGE_SELECT_WITH_TRIP_DETAIL =
  '*, trip_package_items(sort_order, sinai_trips(id, name_ar, name_en, description_ar, description_en, duration, duration_en, images, price, package_price))'

/**
 * Package detail page ONLY — per-trip `price`/`package_price` are
 * intentionally NOT stripped here, so the page can show the "regular price
 * vs in this package" comparison called for in the product spec. Never
 * reuse this for the package rail/cards (getTripPackages) or any other
 * surface — those must keep showing only the aggregate total.
 */
export async function getTripPackageBySlugForDetail(slug: string): Promise<TripPackage | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_packages')
    .select(PACKAGE_SELECT_WITH_TRIP_DETAIL)
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()
  if (error || !data) return null
  const pkg = mapItems(normalizeTripImage(data as unknown as TripPackageRow))
  const totals = computePackageTotals(pkg.trips || [])
  const withTotals = { ...pkg, totals }
  return withTotals.totals?.isValid ? withTotals : null
}

/**
 * SERVER-SIDE / AUTHORITATIVE ONLY — real package_price included, never
 * stripped. For use by /api/bookings and /api/quote to independently
 * recompute Trip Package totals from trusted DB values; never expose this
 * function's return value directly to a client response.
 */
export async function getTripPackagesForPricing(packageIds: string[]): Promise<TripPackage[]> {
  if (!isSupabaseConfigured() || packageIds.length === 0) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_packages')
    .select(PACKAGE_SELECT_SAFE)
    .in('id', packageIds)
    .eq('is_active', true)
  if (error) {
    console.error('getTripPackagesForPricing error:', error)
    return []
  }
  return ((data || []) as unknown as TripPackageRow[])
    .map(normalizeTripImage)
    .map(mapItems)
    .map((pkg) => ({ ...pkg, totals: computePackageTotals(pkg.trips || []) }))
}
