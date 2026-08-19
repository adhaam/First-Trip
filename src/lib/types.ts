// ─── WEEMAP SINAI — Types ───

export type AccommodationType = 'hotel' | 'chalet' | 'camp'
export type BookingType = 'package' | 'accommodation-only' | 'transfer-only'
export type BookingStatus = 'new' | 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type BookingSource =
  | 'website' | 'manual' | 'whatsapp' | 'instagram' | 'facebook' | 'referral' | 'other'
export type TripDuration = 4 | 5
export type PostCategory =
  | 'stories'
  | 'dahab-guide'
  | 'sinai-guide'
  | 'hidden-gems'
  | 'diving'
  | 'freediving'
  | 'climbing'
  | 'hiking'
  | 'watersports'
  | 'history'
  | 'culture'
  | 'itineraries'
  | 'advanced-adventure'
  | 'blog'
export type Governorate = 'cairo' | 'alexandria' | 'zagazig' | 'mansoura'

// ─── Transfers ───
// 'package_bus' = the bus that runs as part of a package (fixed Sun/Thu out, Mon/Fri back)
// 'hiace'       = standalone transfer booking, any day, independent of any package
export type TransferType = 'package_bus' | 'hiace'
export type TransferDirection = 'to_dahab' | 'from_dahab' | 'round_trip'

export interface TransferSettings {
  transfer_type: TransferType
  name_ar: string
  name_en: string
  vehicle_ar: string
  vehicle_en: string
  /** Cairo price, ONE direction, per person. Round trip = base_price * 2. */
  base_price: number
  is_active: boolean
  updated_at?: string
}

export interface TransferGovernoratePrice {
  id: string
  transfer_type: TransferType
  governorate_code: string
  name_ar: string
  name_en: string
  /** Added on top of the Cairo base price, for ONE direction. */
  price_surcharge: number
  sort_order: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

/** Everything the booking forms need to price a transfer, read once on the server. */
export interface TransferPricing {
  settings: TransferSettings[]
  governorates: TransferGovernoratePrice[]
}

/** A meal plan option an accommodation offers, e.g. room-only or all-inclusive. */
export type MealPlanKey = 'room_only' | 'breakfast' | 'half_board' | 'all_inclusive'

export interface MealPlan {
  key: MealPlanKey
  label_ar: string
  label_en: string
  /** Added per person, per night, when the customer picks this plan. */
  price_per_person_per_night: number
  is_active: boolean
}

export interface Accommodation {
  id: string
  name_ar: string
  name_en: string
  type: AccommodationType
  tier?: string  // budget / standard / premium / lagoon
  description_ar: string
  description_en: string
  images: string[]
  image_url?: string  // primary image
  rating: number // 1-5 stars for hotels
  location: string
  location_ar?: string
  location_en?: string
  latitude?: number
  longitude?: number
  amenities_ar: string[]
  amenities_en: string[]
  price_per_night: number // accommodation-only price per person (legacy — kept as a fallback)
  price_4day: number   // 4-day package price per person (legacy — kept as a fallback)
  price_5day: number   // 5-day package price per person (legacy — kept as a fallback)
  /** Per-room price for a double occupancy room. Per-person = this / 2. */
  price_double_room: number
  /** Per-person price for a single occupancy room. */
  price_single_room: number
  /** Per-room price for a triple occupancy room. Per-person = this / 3. */
  price_triple_room: number
  meal_plans: MealPlan[]
  /** Date-range overrides on top of the base price_* columns — see lib/pricing.ts. */
  seasonal_rates?: AccommodationSeasonalRate[]
  is_active: boolean
  created_at: string
  updated_at?: string
}

/** A named date-range pricing period for one accommodation (e.g. "Christmas / New Year"). */
export interface AccommodationSeasonalRate {
  id: string
  accommodation_id: string
  name: string
  start_date: string // ISO date
  end_date: string // ISO date, inclusive
  single_price: number
  double_price: number
  triple_price: number
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface GovernoratePricing {
  id: string
  governorate: Governorate
  name_ar: string
  name_en: string
  price_surcharge: number // additional charge on top of base Cairo price
  is_active: boolean
}

export interface SinaiTrip {
  id: string
  name_ar: string
  name_en: string
  description_ar: string
  description_en: string
  category_ar: string
  category_en: string
  images: string[]
  duration: string   // e.g. "نصف يوم", "Full Day"
  duration_en: string
  /** Normal selling price — used when the trip is booked separately or added as an extra. */
  price: number
  /**
   * What WEEMAP uses when this trip is one of the two included package trips.
   * NULL/undefined = not configured yet; the pricing engine falls back to
   * `price` and the admin dashboard should warn that it's unconfigured.
   */
  package_price?: number | null
  includes_ar: string[]
  includes_en: string[]
  is_active: boolean
  created_at: string
}

export interface TripDate {
  id: string
  date: string // ISO date string
  day_of_week: 'sunday' | 'thursday'
  duration: TripDuration
  is_active: boolean
}

export interface Booking {
  id: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  booking_type: BookingType
  accommodation_id?: string
  /** Joined from `accommodations` on the admin GET route — not present on write. */
  accommodations?: { name_ar: string; name_en: string } | null
  governorate?: string
  trip_date?: string
  return_date?: string
  duration?: TripDuration
  nights?: number
  transfer_type?: TransferType
  transfer_direction?: TransferDirection
  /** 'double'/'triple' split the room price per occupant, 'single' = price_single_room. */
  room_type?: 'double' | 'single' | 'triple'
  meal_plan_key?: MealPlanKey | string
  /** Sinai trip ids the customer added on top of the two included in the package. */
  extra_trip_ids?: string[]
  num_people: number
  notes?: string
  /** Admin-only note, never shown to the customer. */
  internal_notes?: string
  status: BookingStatus
  total_price?: number
  /** Manual payment tracking — no payment gateway involved. */
  payment_status?: PaymentStatus
  amount_paid?: number
  /** Frozen breakdown of every rate used at booking time — see lib/pricing.ts buildPriceSnapshot(). */
  price_snapshot?: PriceSnapshot | null
  /** Which channel this booking came in through. */
  source?: BookingSource
  created_at: string
  updated_at?: string
}

/**
 * Everything that went into a booking's total_price, frozen at creation time.
 * A later change to hotel/trip/transfer prices must NEVER retroactively change
 * a past booking — this snapshot is what the admin bookings detail view reads.
 */
export interface PriceSnapshot {
  room_type?: 'double' | 'single' | 'triple'
  /** Number of rooms charged for this party at booking time. */
  num_rooms?: number
  /** Nightly room rate actually charged, one entry per night of the stay. */
  nightly_room_rates?: { date: string; rate: number; source: 'seasonal' | 'base'; seasonal_rate_name?: string }[]
  nights?: number
  accommodation_subtotal?: number
  transfer_rate_used?: number
  transfer_subtotal?: number
  included_trips?: { trip_id: string; name_en: string; package_cost: number }[]
  included_trips_subtotal?: number
  meal_plan_key?: string
  meal_plan_price_per_person_per_night?: number
  meal_subtotal?: number
  extra_trips?: { trip_id: string; name_en: string; price: number }[]
  extra_trips_subtotal?: number
  num_people?: number
  total: number
  computed_at: string
}

export interface CommunityPost {
  id: string
  title_ar: string
  title_en: string
  content_ar: string
  content_en: string
  category: PostCategory
  image_url?: string | null
  video_url?: string | null
  sort_order: number
  is_pinned: boolean
  is_published: boolean
  created_at: string
}

export interface SiteSettings {
  id: string
  hero_type: 'image' | 'video'
  hero_media_url: string
  whatsapp_number: string
  phone_number: string
  email: string
  facebook_url: string
  instagram_url: string
  location?: string
  logo_url: string
  refund_policy_ar: string
  refund_policy_en: string
  privacy_policy_ar: string
  privacy_policy_en: string
  terms_ar: string
  terms_en: string
  /** Sinai trip ids bundled into every package by default — see lib/pricing.ts. */
  package_included_trip_ids: string[]
  // ─── Website CMS (migration 005) — empty string/array = built-in default ───
  hero_heading_ar?: string
  hero_heading_en?: string
  hero_subheading_ar?: string
  hero_subheading_en?: string
  primary_cta_label_ar?: string
  primary_cta_label_en?: string
  secondary_cta_label_ar?: string
  secondary_cta_label_en?: string
  explore_media_url?: string
  explore_media_alt_ar?: string
  explore_media_alt_en?: string
  explore_copy_ar?: string
  explore_copy_en?: string
  featured_accommodation_ids?: string[]
  featured_trip_ids?: string[]
  show_community?: boolean
  show_partners?: boolean
  show_newsletter?: boolean
  seo_title?: string
  seo_description_ar?: string
  seo_description_en?: string
  social_share_image?: string
  organization_name?: string
}

/** General, structured website/business settings — the "Website" admin section. */
export interface WeemapSiteSettings {
  site_title?: string
  site_description_ar?: string
  site_description_en?: string
  social_share_image?: string
  organization_name?: string
  hero_heading_ar?: string
  hero_heading_en?: string
  hero_subheading_ar?: string
  hero_subheading_en?: string
  primary_cta_label_ar?: string
  primary_cta_label_en?: string
  secondary_cta_label_ar?: string
  secondary_cta_label_en?: string
  featured_accommodation_ids?: string[]
  featured_trip_ids?: string[]
  weemap_picks_ids?: string[]
  show_community_section?: boolean
  show_partners_section?: boolean
  show_newsletter_section?: boolean
  homepage_section_order?: string[]
}

export interface NavItem {
  label_ar: string
  label_en: string
  href: string
  icon?: string
}

export interface ServiceItem {
  title_ar: string
  title_en: string
  description_ar: string
  description_en: string
  icon: string
  href: string
}

export interface Testimonial {
  id: string
  name: string
  text_ar: string
  text_en: string
  rating: number
  avatar_url?: string | null
  trip_ar: string
  trip_en: string
  source: string
  source_url?: string | null
  sort_order: number
  is_published: boolean
  created_at?: string
  updated_at?: string
}

export interface WhyUsPoint {
  title_ar: string
  title_en: string
  description_ar: string
  description_en: string
  icon: string
}
