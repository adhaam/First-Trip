// ─── WEEMAP SINAI — Shop (Merch + Rent) view logic ───
// Pure, framework-free decisions for the Merch/Rent catalogues, product cards
// and rental duration display. Kept out of the client components so the
// "zero inventory -> curating, else catalogue" rule and the catalogue
// filter/sort behaviour are unit-testable without React.
//
// Never computes a charged price — `productMinPrice` / `cheapestRentalTier`
// surface what the server-loaded product already carries (base_price,
// variant price_override, rental_pricing_tiers), for display only. The
// server remains authoritative at checkout (see src/lib/rental-pricing.ts).

import type { CommerceCategory, CommerceProduct, CommerceProductType, RentalPricingTierRow } from './commerce-types'

// ─── Catalogue filter + sort ───

export type CatalogSort = 'featured' | 'price_asc' | 'price_desc' | 'name'

export interface CatalogFilters {
  categoryId?: string | null
  query?: string
}

/** Categories a product-type's chip row should offer — 'both' applies to every surface. */
export function applicableCategories(categories: CommerceCategory[], productType: CommerceProductType): CommerceCategory[] {
  return categories.filter((c) => c.is_active !== false && (c.applies_to === productType || c.applies_to === 'both'))
}

export function filterCatalog(products: CommerceProduct[], filters: CatalogFilters): CommerceProduct[] {
  let list = products
  const categoryId = filters.categoryId
  if (categoryId && categoryId !== 'all') list = list.filter((p) => p.category_id === categoryId)
  const q = filters.query?.trim().toLowerCase()
  if (q) list = list.filter((p) => `${p.name_ar} ${p.name_en}`.toLowerCase().includes(q))
  return list
}

export function sortCatalog(products: CommerceProduct[], sort: CatalogSort): CommerceProduct[] {
  const list = [...products]
  switch (sort) {
    case 'price_asc':
      return list.sort((a, b) => productMinPrice(a) - productMinPrice(b))
    case 'price_desc':
      return list.sort((a, b) => productMinPrice(b) - productMinPrice(a))
    case 'name':
      return list.sort((a, b) => a.name_en.localeCompare(b.name_en))
    case 'featured':
    default:
      return list.sort((a, b) => Number(b.is_featured) - Number(a.is_featured) || a.sort_order - b.sort_order)
  }
}

// ─── Inventory state -> which UI ───

export type CatalogView = 'curating' | 'catalogue'

/** Zero products (before any filter) -> the premium 'curating' empty state;
 *  one or more -> the real catalogue. Never a grey broken grid. */
export function catalogView(products: CommerceProduct[]): CatalogView {
  return products.length === 0 ? 'curating' : 'catalogue'
}

// ─── Price display ───

/** Cheapest price across a merch product's variants (or its own base price
 *  when it has none). Display only — checkout re-resolves the real price. */
export function productMinPrice(product: CommerceProduct): number {
  const variants = product.commerce_product_variants || []
  if (variants.length === 0) return Number(product.base_price)
  return Math.min(...variants.map((v) => (v.price_override != null ? Number(v.price_override) : Number(product.base_price))))
}

/** Whether a merch product's variants are all sold out. Rentals are never
 *  "out of stock" the same way — availability is date-scoped, checked via
 *  /api/commerce/availability, not a flat stock count. */
export function isOutOfStock(product: CommerceProduct): boolean {
  if (product.product_type !== 'sale' || !product.track_inventory) return false
  const variants = product.commerce_product_variants || []
  return variants.length > 0 && variants.every((v) => v.inventory_quantity <= 0)
}

/** The product-level (variant_id null) rental tier with the lowest price —
 *  the "from" figure shown on a rental card before a variant is chosen. */
export function cheapestRentalTier(product: CommerceProduct): RentalPricingTierRow | null {
  const tiers = (product.rental_pricing_tiers || []).filter((t) => t.variant_id === null && t.is_active !== false)
  if (tiers.length === 0) return null
  return tiers.reduce((min, t) => (Number(t.price) < Number(min.price) ? t : min), tiers[0])
}

// ─── Rental day-count display ───

/** Localised duration label for a rental tier or an active quote — prefers
 *  the admin-authored label, falls back to a plain "{n} day(s)" so a tier
 *  with no label never renders blank. */
export function rentalDurationLabel(
  input: { durationDays: number; labelAr?: string | null; labelEn?: string | null },
  ar: boolean,
): string {
  if (ar) return input.labelAr || `${input.durationDays} يوم`
  return input.labelEn || `${input.durationDays} day${input.durationDays === 1 ? '' : 's'}`
}

// ─── Zero-inventory 'Rent' copy: generic categories only, never invented items ───

/** Names of the categories WEEMAP's rental surface actually has configured
 *  (applies_to 'rental' | 'both'), for the curating empty state to gesture at
 *  "what we rent" without listing products that don't exist yet. */
export function rentalCategoryLabels(categories: CommerceCategory[], ar: boolean): string[] {
  return applicableCategories(categories, 'rental')
    .map((c) => (ar ? c.name_ar : c.name_en))
    .filter((name): name is string => Boolean(name && name.trim()))
}
