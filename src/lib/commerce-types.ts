// ─── WEEMAP SINAI — Commerce (Merch + Rental) types ───
// Mirrors supabase/migrations/013_unified_commerce_foundation.sql and
// 015_commerce_storefront_foundation.sql. Kept separate from lib/types.ts
// (accommodation/trip domain) since this is a distinct product surface.

export type CommerceProductType = 'sale' | 'rental'
export type FulfillmentMethod = 'pickup' | 'delivery'
export type CommerceOrderStatus =
  | 'new' | 'contacted' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
export type RentalReservationStatus =
  | 'requested' | 'contacted' | 'confirmed' | 'active' | 'returned' | 'completed' | 'cancelled' | 'late'
export type DeliveryFeeType = 'fixed' | 'free' | 'quote'

export interface CommerceCategory {
  id: string
  slug: string
  applies_to: 'sale' | 'rental' | 'both'
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  image_url: string
  icon: string
  is_active: boolean
  is_featured: boolean
  sort_order: number
}

export interface CommerceCollection {
  id: string
  slug: string
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  image_url: string
  is_active: boolean
  sort_order: number
}

export interface CommerceOptionValue {
  id: string
  option_id: string
  value_ar: string
  value_en: string
  sort_order: number
}

export interface CommerceProductOption {
  id: string
  product_id: string
  name_ar: string
  name_en: string
  sort_order: number
  commerce_product_option_values: CommerceOptionValue[]
}

export interface CommerceProductVariant {
  id: string
  product_id: string
  sku: string | null
  option_value_ids: string[]
  price_override: number | null
  inventory_quantity: number
  is_active: boolean
  image_url: string
  sort_order: number
}

export interface RentalPricingTierRow {
  id: string
  product_id: string
  variant_id: string | null
  duration_days: number
  label_ar: string
  label_en: string
  price: number
  sort_order: number
  is_active: boolean
}

export interface CommerceProduct {
  id: string
  category_id: string | null
  product_type: CommerceProductType
  slug: string
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  images: string[]
  base_price: number
  compare_at_price: number | null
  badge_text: string
  sku: string | null
  track_inventory: boolean
  requires_delivery: boolean
  pickup_enabled: boolean
  delivery_enabled: boolean
  deposit_amount: number
  rental_requirements: string[]
  pickup_instructions_ar: string
  pickup_instructions_en: string
  is_active: boolean
  is_featured: boolean
  sort_order: number
  seo_title?: string
  seo_description_ar?: string
  seo_description_en?: string
  commerce_categories?: { name_ar: string; name_en: string; slug: string } | null
  commerce_product_variants?: CommerceProductVariant[]
  rental_pricing_tiers?: RentalPricingTierRow[]
  commerce_product_options?: CommerceProductOption[]
  collection_ids?: string[]
  /** Total inventory across all variants, or product-level qty when no variants. */
  total_inventory?: number
}

export interface DeliveryZone {
  id: string
  name_ar: string
  name_en: string
  fee_type: DeliveryFeeType
  fixed_fee: number
  is_active: boolean
  sort_order: number
}

export interface RentalAvailabilityBlock {
  id: string
  product_id: string
  variant_id: string | null
  quantity: number
  start_date: string
  end_date: string
  reason: string
  created_at: string
}

// ─── Cart (client-side only, never authoritative) ───

export interface CartMerchItem {
  kind: 'merch'
  /** Client-generated line id, stable across re-renders. */
  lineId: string
  productId: string
  variantId: string | null
  slug: string
  nameAr: string
  nameEn: string
  image: string
  optionSummaryAr: string
  optionSummaryEn: string
  unitPriceEstimate: number
  quantity: number
}

export interface CartRentalItem {
  kind: 'rental'
  lineId: string
  productId: string
  variantId: string | null
  slug: string
  nameAr: string
  nameEn: string
  image: string
  optionSummaryAr: string
  optionSummaryEn: string
  durationDays: number
  durationLabelAr: string
  durationLabelEn: string
  startDate: string
  endDate: string
  quantity: number
  unitPriceEstimate: number
}

export type CartItem = CartMerchItem | CartRentalItem

export interface CartState {
  version: 2
  items: CartItem[]
  fulfillmentMethod: FulfillmentMethod
  deliveryZoneId: string | null
  deliveryAddress: string
}
