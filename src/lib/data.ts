// ─── Server-side data layer — real Supabase reads/writes ───
// Use only in Server Components, Route Handlers, or Server Actions.
// Uses the service-role client so it must never be imported into a 'use client' file.

import 'server-only'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase'
import type {
  Accommodation,
  AccommodationSeasonalRate,
  RoomUpgrade,
  SinaiTrip,
  CommunityPost,
  SiteSettings,
  TripDate,
  GovernoratePricing,
  Testimonial,
  TransferGovernoratePrice,
  TransferPricing,
  TransferSettings,
} from './types'
import type { CommerceCategory, CommerceCollection, CommerceProduct, CommerceProductType, DeliveryZone } from './commerce-types'

export async function getAccommodations(): Promise<Accommodation[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  // sort_order added in migration 012; created_at is the deterministic tie-breaker
  const { data, error } = await supabase
    .from('accommodations')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    // Migration 012 not yet applied — sort_order column missing (42703).
    // Fall back to created_at ordering so the page still loads.
    if (error.code === '42703' || error.message?.toLowerCase().includes('sort_order')) {
      const { data: fallback } = await supabase
        .from('accommodations')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      return (fallback ?? []) as Accommodation[]
    }
    console.error('getAccommodations error:', error)
    return []
  }
  return (data ?? []) as Accommodation[]
}

export async function getAccommodationById(id: string): Promise<Accommodation | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const [{ data, error }, rates, upgrades] = await Promise.all([
    supabase.from('accommodations').select('*').eq('id', id).eq('is_active', true).maybeSingle(),
    getSeasonalRates(id),
    getRoomUpgrades(id),
  ])

  if (error) {
    console.error('getAccommodationById error:', error)
    return null
  }
  if (!data) return null
  return { ...(data as Accommodation), seasonal_rates: rates, room_upgrades: upgrades }
}

/**
 * Active room upgrade tiers for one accommodation, sorted for display.
 * Returns [] gracefully when migration 011 (accommodation_room_upgrades) has not
 * been applied yet — the booking form treats empty upgrades as "no upgrades".
 */
export async function getRoomUpgrades(accommodationId: string): Promise<RoomUpgrade[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodation_room_upgrades')
    .select('*')
    .eq('accommodation_id', accommodationId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    // Migration 011 not applied yet — return empty gracefully
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
      return []
    }
    console.error('getRoomUpgrades error:', error)
    return []
  }
  return (data ?? []).map((r) => ({
    ...(r as RoomUpgrade),
    extra_price_per_night: Number(r.extra_price_per_night ?? 0),
  }))
}

/** Active seasonal pricing periods for one accommodation, soonest first. */
export async function getSeasonalRates(accommodationId: string): Promise<AccommodationSeasonalRate[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('accommodation_seasonal_rates')
    .select('*')
    .eq('accommodation_id', accommodationId)
    .eq('is_active', true)
    .order('start_date', { ascending: true })

  if (error) {
    console.error('getSeasonalRates error:', error)
    return []
  }
  // NUMERIC comes back as strings — coerce once here.
  return (data ?? []).map((r) => ({
    ...(r as AccommodationSeasonalRate),
    single_price: Number(r.single_price ?? 0),
    double_price: Number(r.double_price ?? 0),
    triple_price: Number(r.triple_price ?? 0),
  }))
}

export async function getSinaiTrips(): Promise<SinaiTrip[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  // sort_order added in migration 012; created_at is the deterministic tie-breaker
  const { data, error } = await supabase
    .from('sinai_trips')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) {
    // Migration 012 not yet applied — sort_order column missing (42703).
    // Fall back to created_at ordering so the page still loads.
    if (error.code === '42703' || error.message?.toLowerCase().includes('sort_order')) {
      const { data: fallback } = await supabase
        .from('sinai_trips')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: true })
      return (fallback ?? []) as SinaiTrip[]
    }
    console.error('getSinaiTrips error:', error)
    return []
  }
  return (data ?? []) as SinaiTrip[]
}

export async function getSinaiTripById(id: string): Promise<SinaiTrip | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('sinai_trips')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .maybeSingle()

  if (error) {
    console.error('getSinaiTripById error:', error)
    return null
  }
  return data as SinaiTrip | null
}

export async function getCommunityPosts(): Promise<CommunityPost[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('community_posts')
    .select('*')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('sort_order', { ascending: true })

  if (error) {
    console.error('getCommunityPosts error:', error)
    return []
  }
  return (data ?? []) as CommunityPost[]
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) {
    console.error('getSiteSettings error:', error)
    return null
  }
  return data as SiteSettings
}

export async function getTripDates(): Promise<TripDate[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('trip_dates')
    .select('*')
    .eq('is_active', true)
    .gte('trip_date', new Date().toISOString().slice(0, 10))
    .order('trip_date', { ascending: true })

  if (error) {
    console.error('getTripDates error:', error)
    return []
  }
  // DB column is `trip_date`; frontend type uses `date`
  return (data ?? []).map((d) => ({
    id: d.id,
    date: d.trip_date,
    day_of_week: d.day_of_week,
    duration: d.duration,
    is_active: d.is_active,
  })) as TripDate[]
}

// Pure helper (no fetch) — same-type first, then closest price, capped at 3
export function getRelatedAccommodations(current: Accommodation, all: Accommodation[]): Accommodation[] {
  const sameType = all.filter(a => a.id !== current.id && a.type === current.type && a.is_active)
  const similarPrice = all
    .filter(a => a.id !== current.id && a.type !== current.type && a.is_active)
    .sort((a, b) =>
      Math.abs(a.price_per_night - current.price_per_night) -
      Math.abs(b.price_per_night - current.price_per_night)
    )
  return [...sameType, ...similarPrice].slice(0, 3)
}

/**
 * Everything the booking forms need to price a transfer.
 * Read once per page on the server and passed down to the client components —
 * no price is ever hardcoded in the UI.
 */
export async function getTransferPricing(): Promise<TransferPricing> {
  if (!isSupabaseConfigured()) return { settings: [], governorates: [] }
  const supabase = getSupabaseAdmin()

  const [settingsRes, govRes] = await Promise.all([
    supabase.from('transfer_settings').select('*').eq('is_active', true),
    supabase
      .from('transfer_governorate_pricing')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
  ])

  if (settingsRes.error) console.error('getTransferPricing settings error:', settingsRes.error)
  if (govRes.error) console.error('getTransferPricing governorates error:', govRes.error)

  return {
    settings: (settingsRes.data ?? []).map(normalizeTransferSettings),
    governorates: (govRes.data ?? []).map(normalizeTransferGovernorate),
  }
}

// Supabase returns NUMERIC columns as strings — coerce once, here, so the rest
// of the app can trust that a price is a number.
type RawRow = Record<string, unknown>

function normalizeTransferSettings(row: RawRow): TransferSettings {
  return { ...(row as unknown as TransferSettings), base_price: Number(row.base_price ?? 0) }
}

function normalizeTransferGovernorate(row: RawRow): TransferGovernoratePrice {
  return {
    ...(row as unknown as TransferGovernoratePrice),
    price_surcharge: Number(row.price_surcharge ?? 0),
  }
}

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .eq('is_published', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('getTestimonials error:', error)
    return []
  }
  const legacy = /first\s*-?\s*trip|firsttrip/i
  return ((data ?? []) as Testimonial[]).filter((item) =>
    !legacy.test(`${item.name} ${item.text_ar} ${item.text_en} ${item.trip_ar} ${item.trip_en}`),
  )
}

export async function getGovernoratePricing(): Promise<GovernoratePricing[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('governorate_pricing')
    .select('*')
    .eq('is_active', true)

  if (error) {
    console.error('getGovernoratePricing error:', error)
    return []
  }
  return (data ?? []) as GovernoratePricing[]
}

// ─── Commerce (Merch + Rental) — see src/lib/commerce-types.ts ───

export async function getCommerceCategories(): Promise<CommerceCategory[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) {
    console.error('getCommerceCategories error:', error)
    return []
  }
  return (data ?? []) as CommerceCategory[]
}

export async function getCommerceProducts(productType: CommerceProductType): Promise<CommerceProduct[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_products')
    .select('*, commerce_categories(name_ar, name_en, slug), commerce_product_variants(*), rental_pricing_tiers(*)')
    .eq('is_active', true)
    .eq('product_type', productType)
    .is('archived_at', null)
    .order('sort_order')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('getCommerceProducts error:', error)
    return []
  }
  return (data ?? []) as unknown as CommerceProduct[]
}

export async function getCommerceCollections(productIds?: Set<string>): Promise<(CommerceCollection & { product_ids: string[] })[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data: collections, error } = await supabase
    .from('commerce_collections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error || !collections?.length) return []

  const { data: links } = await supabase
    .from('commerce_product_collections')
    .select('collection_id, product_id')
    .in('collection_id', collections.map((c) => c.id))

  const byCollection = new Map<string, string[]>()
  for (const l of links || []) {
    if (productIds && !productIds.has(l.product_id)) continue
    const list = byCollection.get(l.collection_id) || []
    list.push(l.product_id)
    byCollection.set(l.collection_id, list)
  }
  return collections.map((c) => ({ ...c, product_ids: byCollection.get(c.id) || [] }))
}

export async function getCommerceProductBySlug(slug: string): Promise<CommerceProduct | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_products')
    .select(`
      *,
      commerce_categories(name_ar, name_en, slug),
      commerce_product_variants(*),
      rental_pricing_tiers(*),
      commerce_product_options(*, commerce_product_option_values(*)),
      commerce_product_collections(collection_id)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .is('archived_at', null)
    .maybeSingle()
  if (error || !data) return null
  const variants = (data.commerce_product_variants || []).filter((v: { is_active: boolean }) => v.is_active)
  const totalInventory = variants.length
    ? variants.reduce((sum: number, v: { inventory_quantity: number }) => sum + Number(v.inventory_quantity), 0)
    : 0
  return {
    ...data,
    commerce_product_variants: variants,
    rental_pricing_tiers: (data.rental_pricing_tiers || []).filter((t: { is_active: boolean }) => t.is_active),
    collection_ids: (data.commerce_product_collections || []).map((c: { collection_id: string }) => c.collection_id),
    total_inventory: totalInventory,
  } as unknown as CommerceProduct
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('delivery_zones').select('*').eq('is_active', true).order('sort_order')
  if (error) {
    console.error('getDeliveryZones error:', error)
    return []
  }
  return (data ?? []) as DeliveryZone[]
}
