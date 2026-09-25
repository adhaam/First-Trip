import { NextResponse, type NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport/today'
import { isMissingOpsRelation } from '@/lib/ops/server'

type Issue = { type: string, id: string, title_en: string, title_ar: string, code: string, detail?: string }
/** Matches the trip_package_items(trip_id, sinai_trips(package_price)) join below. */
type TripPackageItemRow = { trip_id: string, sinai_trips: { package_price: number | null } | null }
/** Matches the commerce_product_variants(is_active, inventory_quantity) join below. */
type CommerceVariantRow = { is_active: boolean, inventory_quantity: number | null }
/** Matches the rental_pricing_tiers(is_active) join below. */
type RentalPricingTierRow = { is_active: boolean }
/** Matches the experience_dates(start_date, status, is_open) join below. */
type ExperienceDateRow = { start_date: string, status: string, is_open: boolean }

/**
 * Catalogue completeness checks, for ACTIVE items only. Every rule below was grounded against the
 * live local DB schema (docker exec weemap-local-db psql). A rule that could not be grounded that
 * way is skipped and called out in this comment rather than guessed:
 *   - "accommodations ... no room price": there is no single "room price" column. A stay is priced
 *     from price_double_room / price_single_room / price_triple_room, so "no room price" is read
 *     here as all three of those being zero.
 */
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const issues: Issue[] = []
  const push = (issue: Issue) => issues.push(issue)

  try {
    await Promise.all([
      checkAccommodations(supabase, push),
      checkSinaiTrips(supabase, push),
      checkTripPackages(supabase, push),
      checkCommerceProducts(supabase, push),
      checkSignatureExperiences(supabase, push),
    ])
    return NextResponse.json({ issues })
  } catch (error) {
    console.error('catalogue health error:', error)
    return NextResponse.json(
      {
        error: 'Failed to load catalogue health',
        ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}),
      },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}

type Push = (issue: Issue) => void

async function checkAccommodations(supabase: SupabaseClient, push: Push) {
  const { data, error } = await supabase
    .from('accommodations')
    .select('id, name_en, name_ar, images, price_double_room, price_single_room, price_triple_room')
    .eq('is_active', true)
  if (error) throw error
  for (const row of data ?? []) {
    const base = { type: 'accommodation', id: row.id, title_en: row.name_en, title_ar: row.name_ar }
    if (!row.images || row.images.length === 0) push({ ...base, code: 'no_images' })
    const prices = [row.price_double_room, row.price_single_room, row.price_triple_room]
    if (prices.every((price) => !price || Number(price) <= 0)) push({ ...base, code: 'no_room_price' })
  }
}

async function checkSinaiTrips(supabase: SupabaseClient, push: Push) {
  const { data, error } = await supabase
    .from('sinai_trips')
    .select('id, name_en, name_ar, price, images, sinai_trip_category_tags(trip_id)')
    .eq('is_active', true)
  if (error) throw error
  for (const row of data ?? []) {
    const base = { type: 'sinai_trip', id: row.id, title_en: row.name_en, title_ar: row.name_ar }
    if (!(Number(row.price) > 0)) push({ ...base, code: 'no_price' })
    if (!row.sinai_trip_category_tags || row.sinai_trip_category_tags.length === 0) {
      push({ ...base, code: 'no_category_tag' })
    }
    if (!row.images || row.images.length === 0) push({ ...base, code: 'no_images' })
  }
}

async function checkTripPackages(supabase: SupabaseClient, push: Push) {
  const { data, error } = await supabase
    .from('trip_packages')
    .select('id, name_en, name_ar, trip_package_items(trip_id, sinai_trips(package_price))')
    .eq('is_active', true)
  if (error) throw error
  for (const row of data ?? []) {
    const base = { type: 'trip_package', id: row.id, title_en: row.name_en, title_ar: row.name_ar }
    const items = (row.trip_package_items as unknown as TripPackageItemRow[]) ?? []
    if (items.length < 2) push({ ...base, code: 'too_few_items', detail: `${items.length} item(s)` })
    const missingPrice = items.some((item) => (
      item.sinai_trips?.package_price === null || item.sinai_trips?.package_price === undefined
    ))
    if (missingPrice) push({ ...base, code: 'item_missing_package_price' })
  }
}

async function checkCommerceProducts(supabase: SupabaseClient, push: Push) {
  const { data, error } = await supabase
    .from('commerce_products')
    .select([
      'id', 'name_en', 'name_ar', 'product_type',
      'commerce_product_variants(is_active, inventory_quantity)',
      'rental_pricing_tiers(is_active)',
    ].join(', '))
    .eq('is_active', true)
  if (error) throw error
  type ProductRow = {
    id: string; name_en: string; name_ar: string; product_type: string
    commerce_product_variants: unknown; rental_pricing_tiers: unknown
  }
  for (const row of (data ?? []) as unknown as ProductRow[]) {
    const base = { type: 'commerce_product', id: row.id, title_en: row.name_en, title_ar: row.name_ar }
    const variants = (row.commerce_product_variants as CommerceVariantRow[]) ?? []
    const activeVariants = variants.filter((variant) => variant.is_active)
    if (row.product_type === 'sale') {
      if (activeVariants.length === 0) {
        push({ ...base, code: 'no_active_variant' })
      } else if (activeVariants.every((v) => Number(v.inventory_quantity ?? 0) <= 0)) {
        push({ ...base, code: 'zero_stock' })
      }
    } else if (row.product_type === 'rental') {
      const tiers = (row.rental_pricing_tiers as RentalPricingTierRow[]) ?? []
      if (!tiers.some((tier) => tier.is_active)) push({ ...base, code: 'no_active_pricing_tier' })
    }
  }
}

async function checkSignatureExperiences(supabase: SupabaseClient, push: Push) {
  const today = todayInCairo()
  const { data, error } = await supabase
    .from('experiences')
    .select('id, title_en, title_ar, experience_dates(start_date, status, is_open)')
    .eq('status', 'published')
  if (error) throw error
  for (const row of data ?? []) {
    const dates = (row.experience_dates as ExperienceDateRow[]) ?? []
    const hasUpcomingOpen = dates.some((date) => date.is_open && date.status === 'open' && date.start_date >= today)
    if (!hasUpcomingOpen) {
      push({
        type: 'signature_experience', id: row.id, title_en: row.title_en, title_ar: row.title_ar,
        code: 'no_upcoming_open_date',
      })
    }
  }
}
