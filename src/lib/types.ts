// ─── First Trip — Types ───

export type AccommodationType = 'hotel' | 'chalet' | 'camp'
export type BookingType = 'package' | 'accommodation-only' | 'transfer-only'
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type TripDuration = 4 | 5
export type PostCategory = 'blog' | 'hidden-gems' | 'stories' | 'dahab-guide'
export type Governorate = 'cairo' | 'alexandria' | 'zagazig' | 'mansoura'

export interface Accommodation {
  id: string
  name_ar: string
  name_en: string
  type: AccommodationType
  description_ar: string
  description_en: string
  images: string[]
  rating: number // 1-5 stars for hotels
  location: string
  amenities_ar: string[]
  amenities_en: string[]
  price_per_night: number // accommodation-only price per person
  price_4day: number   // 4-day package price per person
  price_5day: number   // 5-day package price per person
  is_active: boolean
  created_at: string
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
  governorate?: Governorate
  trip_date?: string
  duration?: TripDuration
  num_people: number
  notes?: string
  status: BookingStatus
  total_price?: number
  created_at: string
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
  name: string
  text_ar: string
  text_en: string
  rating: number
  avatar?: string
}

export interface WhyUsPoint {
  title_ar: string
  title_en: string
  description_ar: string
  description_en: string
  icon: string
}