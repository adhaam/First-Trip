// ─── First Trip — Types ───

export type AccommodationType = 'hotel' | 'chalet' | 'camp'
export type BookingType = 'package' | 'accommodation-only' | 'transfer-only'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type TripDuration = 4 | 5
export type PostCategory = 'blog' | 'hidden-gems' | 'stories' | 'dahab-guide'
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
  /** Per-room price for a double/triple occupancy room. Per-person = this / 2. */
  price_double_room: number
  /** Per-person price for a single occupancy room. */
  price_single_room: number
  meal_plans: MealPlan[]
  is_active: boolean
  created_at: string
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
  price: number
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
  /** 'double' = split price_double_room / 2 per person, 'single' = price_single_room. */
  room_type?: 'double' | 'single'
  meal_plan_key?: MealPlanKey | string
  /** Sinai trip ids the customer added on top of the two included in the package. */
  extra_trip_ids?: string[]
  num_people: number
  notes?: string
  status: BookingStatus
  total_price?: number
  /** 'website' = came through the booking form, 'manual' = logged by an admin (phone/WhatsApp/walk-in). */
  source?: 'website' | 'manual'
  created_at: string
  updated_at?: string
}

export interface CommunityPost {
  id: string
  title_ar: string
  title_en: string
  content_ar: string
  content_en: string
  category: PostCategory
  image_url?: string
  video_url?: string
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
  logo_url: string
  refund_policy_ar: string
  refund_policy_en: string
  privacy_policy_ar: string
  privacy_policy_en: string
  terms_ar: string
  terms_en: string
  /** Sinai trip ids bundled into every package by default — see lib/pricing.ts. */
  package_included_trip_ids: string[]
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