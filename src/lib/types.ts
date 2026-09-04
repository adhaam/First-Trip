// ─── WEEMAP SINAI — Types ───

export type AccommodationType = 'hotel' | 'chalet' | 'camp'
export type BookingType = 'package' | 'accommodation-only' | 'transfer-only'
export type BookingStatus = 'new' | 'pending' | 'confirmed' | 'cancelled' | 'completed'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'
export type BookingSource =
  | 'website' | 'manual' | 'whatsapp' | 'instagram' | 'facebook' | 'referral' | 'other'
export type TripDuration = 4 | 5
/**
 * Discount kinds. Matches the convention already established for Signature
 * Experiences (see lib/experience-pricing.ts) and the shape the DB enforces:
 * a CHECK constraint allows only 'amount' | 'percentage', and NULL means no
 * discount. Do NOT introduce a 'none' sentinel — NULL is the absence.
 */
export type TripDiscountType = 'amount' | 'percentage'
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

/**
 * Additive server-side context proposed for Ask WEEMAP qualification.
 * It is intentionally separate from pricing internals and remains optional
 * until migration 010 is reviewed and applied to production.
 */
export interface AiQualificationContext {
  durationDays?: 4 | 5
  nights?: 3 | 4
  partySize?: number
  travelStartDate?: string
  travelPeriodText?: string
  budgetEgp?: number
  accommodationPreference?: string
  selectedAccommodationId?: string
  selectedAccommodationName?: string
  lastQuoteTotal?: number
  lastQuotePerPerson?: number
  buyingIntent?: boolean
  handoffReady?: boolean
}

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

/**
 * A room upgrade tier for an accommodation (e.g. Sea View, Deluxe).
 * extra_price_per_night is a fixed supplement per ROOM per night added on top of
 * the base single/double/triple room price. Added in migration 011.
 */
export interface RoomUpgrade {
  id: string
  accommodation_id: string
  name_ar: string
  name_en: string
  /** Fixed EGP supplement per room per night on top of base room rate. 0 = Standard/No extra. */
  extra_price_per_night: number
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at?: string
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
  /**
   * Optional room upgrade tiers (Sea View, Deluxe, etc.). Fetched alongside the
   * accommodation for the booking form. Added in migration 011.
   * Empty or undefined = no upgrades; simple hotels remain unchanged.
   */
  room_upgrades?: RoomUpgrade[]
  /** Admin-controlled display order. Lower = shown first. Added in migration 012. */
  sort_order: number
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
  /** FK to trip_categories (migration 016). Nullable for trips created before the taxonomy existed. */
  trip_category_id?: string | null
  images: string[]
  duration: string   // e.g. "نصف يوم", "Full Day"
  duration_en: string
  /** Normal selling price — used when the trip is booked separately or added as an extra. */
  price: number
  /**
   * Legacy package-cost field, retained for historical bookings/snapshots.
   * The two included package trips are a free perk — the live pricing engine
   * no longer reads this for included-trip pricing (see `includedTripCost`
   * in src/lib/pricing.ts).
   */
  package_price?: number | null
  /**
   * Discount on the public `price` only (migration 022) — `package_price` is
   * never discounted. Resolve with effectiveTripPrice() in lib/pricing.ts;
   * never apply the percentage or subtraction inline at a call site.
   */
  discount_type?: TripDiscountType | null
  discount_value?: number | null
  /** Optional window. NULL start = already active, NULL end = no expiry. */
  discount_starts_at?: string | null
  discount_ends_at?: string | null
  includes_ar: string[]
  includes_en: string[]
  /** Admin-controlled display order. Lower = shown first. Added in migration 012. */
  sort_order: number
  is_active: boolean
  created_at: string
}

/** Controlled Sinai Trip taxonomy (migration 016). */
export interface TripCategory {
  id: string
  slug: string
  name_ar: string
  name_en: string
  is_active: boolean
  sort_order: number
}

/** Package Categories (migration 017) — owner-managed, unlike the fixed TripCategory taxonomy. */
export interface TripPackageCategory {
  id: string
  slug: string
  name_ar: string
  name_en: string
  is_active: boolean
  sort_order: number
}

/**
 * A curated bundle of existing Sinai Trips (migration 017). `trips` is only
 * populated by fetchers that join trip_package_items — see
 * src/lib/trip-packages.ts. `package_total`/`public_total`/`savings` are
 * always computed live from the joined trips' price/package_price, never
 * cached on this row.
 */
export interface TripPackage {
  id: string
  slug: string
  name_ar: string
  name_en: string
  short_description_ar: string
  short_description_en: string
  description_ar: string
  description_en: string
  image: string
  badge_ar?: string | null
  badge_en?: string | null
  package_category_id?: string | null
  featured: boolean
  is_active: boolean
  sort_order: number
  created_at: string
  /** Present when fetched with items joined (admin editor, public detail/rail). */
  trips?: TripPackageTrip[]
  /**
   * Computed aggregate totals — the ONLY pricing info public fetchers send to
   * the client. Per-trip `package_price` is always stripped before a
   * TripPackage reaches a public page (see stripPackagePrice-style handling
   * in src/lib/trip-packages.ts); this pre-computed total is how the
   * customer-visible price still gets through.
   */
  totals?: { publicTotal: number; packageTotal: number; savings: number; isValid: boolean }
}

/** A trip as it appears inside a package, carrying only what's safe to compute a total from. */
export interface TripPackageTrip {
  id: string
  name_ar: string
  name_en: string
  image?: string | null
  price: number
  package_price: number | null
  sort_order: number
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
  /** Sinai trip ids the customer added individually, priced at public `price`. */
  extra_trip_ids?: string[]
  /** Trip Packages selected at booking time — see price_snapshot.trip_packages for the frozen totals. */
  trip_package_ids?: string[]
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
/** Per-allocation snapshot for multi-room bookings with optional upgrade. */
export interface RoomAllocationSnapshot {
  room_type: 'double' | 'single' | 'triple'
  quantity: number
  base_nightly_rate: number
  /** undefined = no upgrade selected */
  upgrade_id?: string
  upgrade_name?: string
  /** 0 or undefined when no upgrade */
  upgrade_extra_per_night?: number
  /** base_nightly_rate + upgrade_extra_per_night */
  final_nightly_rate: number
}

export interface PriceSnapshot {
  room_type?: 'double' | 'single' | 'triple'
  /** Number of rooms charged for this party at booking time. */
  num_rooms?: number
  /** Nightly room rate actually charged, one entry per night of the stay. */
  nightly_room_rates?: { date: string; rate: number; source: 'seasonal' | 'base'; seasonal_rate_name?: string }[]
  /**
   * Per-allocation breakdown when multiple room types were selected,
   * including any upgrade supplement. Added in migration 011.
   */
  room_allocations?: RoomAllocationSnapshot[]
  nights?: number
  accommodation_subtotal?: number
  transfer_rate_used?: number
  transfer_subtotal?: number
  included_trips?: { trip_id: string; name_en: string; package_cost: number }[]
  included_trips_subtotal?: number
  meal_plan_key?: string
  meal_plan_price_per_person_per_night?: number
  meal_subtotal?: number
  /**
   * `price` is what was actually charged per person (post-discount). The two
   * discount fields are present only when a discount applied, so the invoice
   * can show the customer the saving instead of a silently lower number.
   */
  extra_trips?: {
    trip_id: string
    name_en: string
    price: number
    price_before_discount?: number
    discount_per_person?: number
  }[]
  extra_trips_subtotal?: number
  /**
   * Trip Packages selected at booking time (migration 017). Each entry's
   * `total` is SUM(package_price) for that package's trips, frozen here —
   * never re-derived from live sinai_trips prices after booking.
   */
  trip_packages?: { package_id: string; name_en: string; trip_names_en: string[]; total: number }[]
  trip_packages_subtotal?: number
  num_people?: number
  total: number
  /**
   * Set when an admin deliberately replaced the computed total for an
   * exceptional case. `total` then holds the agreed amount and
   * `computed_total` what the pricing engine had produced — the components
   * above still describe the booking, so the invoice stays itemised and the
   * difference remains auditable instead of vanishing into one number.
   */
  price_override?: boolean
  computed_total?: number
  price_override_reason?: string
  computed_at: string
}

/**
 * Frozen pricing for a single-trip booking (migration 022). Same "never
 * re-derive" contract as PriceSnapshot: a discount that later changes or
 * expires must not move the price of a booking already made.
 */
export interface TripBookingPriceSnapshot {
  /** Undiscounted public price, per person. */
  unit_price_before_discount: number
  /** What came off each person's price. 0 when no discount applied. */
  discount_per_person: number
  /** Null when no discount applied — never a 'none' sentinel. */
  discount_type: TripDiscountType | null
  /** Percentage points when type is 'percentage', EGP when 'amount'. */
  discount_value: number
  /** unit_price_before_discount - discount_per_person. */
  unit_price: number
  num_people: number
  /** unit_price * num_people, unless an admin overrode it — see below. */
  total: number
  /**
   * Set when an admin replaced the calculated total. The per-person figures
   * above still describe how the trip was priced, so the invoice stays
   * itemised and the gap remains auditable.
   */
  price_override?: boolean
  computed_total?: number
  price_override_reason?: string
  computed_at: string
}

export interface CommunityPost {
  id: string
  slug: string | null
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
  updated_at?: string
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
  /**
   * Legacy field, retained for historical data only. The 2 free Sinai trips
   * are a fixed marketing benefit — no live pricing path reads this, and the
   * admin API no longer accepts writes to it (see SiteSettingsManager.tsx).
   */
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
  /** Lucide icon key — see NAV_ICONS in components/layout/Header.tsx. */
  icon?: string
  /** Shown directly in the desktop bar. Everything else lives under "More". */
  primary?: boolean
  /** Grouping used by the mobile drawer. */
  group?: 'plan' | 'shop' | 'weemap'
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

// ─── Signature Experiences (migration 018) ───
// A separate, independently-priced product family — NOT a Trip Package.
// See src/lib/pricing.ts header comment for the pricing-path boundary.

export interface ExperienceCategory {
  slug: string
  label_ar: string
  label_en: string
  description_ar: string
  description_en: string
  is_active: boolean
  sort_order: number
}

export interface ExperienceItineraryStep {
  title_ar: string
  title_en: string
  description_ar?: string
  description_en?: string
}

/** Admin-only shape — includes every private partner field. Never send this directly to a public page. */
export interface ExperiencePartner {
  id: string
  name: string
  service_category: string
  public_description_ar: string
  public_description_en: string
  contact_name: string
  contact_phone: string
  contact_email: string
  internal_notes: string
  public_credit_enabled: boolean
  is_active: boolean
  created_at: string
  updated_at?: string
}

/** The only partner shape a public page may ever receive — no contact info, no internal notes. */
export interface PublicExperiencePartner {
  id: string
  name: string
  public_description_ar: string
  public_description_en: string
}

export interface ExperienceDate {
  id: string
  experience_id: string
  start_date: string
  end_date: string
  total_spots: number
  status: 'open' | 'cancelled'
  is_open: boolean
  price_override?: number | null
}

export interface Experience {
  id: string
  slug: string
  title_ar: string
  title_en: string
  category?: string | null
  short_description_ar: string
  short_description_en: string
  full_description_ar: string
  full_description_en: string
  included_ar: string[]
  included_en: string[]
  not_included_ar: string[]
  not_included_en: string[]
  itinerary: ExperienceItineraryStep[]
  hero_image: string
  gallery: string[]
  duration_ar: string
  duration_en: string
  /** Independent, Admin-managed price. NEVER derived from Trip Package / package_price math. */
  price: number
  currency: 'EGP' | 'USD'
  discount_value?: number | null
  discount_type?: 'amount' | 'percentage' | null
  discount_label: string
  badge_ar?: string | null
  badge_en?: string | null
  featured: boolean
  starting_from_price: boolean
  status: 'draft' | 'published'
  sort_order: number
  created_at: string
  updated_at?: string
  /** Joined data — present depending on which fetcher populated it. */
  category_info?: ExperienceCategory | null
  dates?: ExperienceDate[]
  /** Public pages only ever get PublicExperiencePartner[] — never the full ExperiencePartner. */
  partners?: PublicExperiencePartner[]
  trips?: Pick<SinaiTrip, 'id' | 'name_ar' | 'name_en' | 'images'>[]
}

export type ExperienceRequestStatus = 'new' | 'contacted' | 'planning' | 'confirmed' | 'completed' | 'cancelled'

/** A Signature request — either against a published Experience, or a fully custom "Build Your Signature" request. */
export interface ExperienceBooking {
  id: string
  experience_id?: string | null
  experience_date_id?: string | null
  customer_id?: string | null
  full_name: string
  phone: string
  email?: string
  spots_requested: number
  notes: string
  is_custom_request: boolean
  preferred_date?: string | null
  interests: string
  duration_preference: string
  quoted_price?: number | null
  currency: string
  status: ExperienceRequestStatus
  source: string
  payment_status: 'unpaid' | 'partial' | 'paid' | 'refunded'
  amount_paid: number
  created_at: string
  updated_at?: string
  /** Joined on the admin GET route. */
  experiences?: { title_ar: string; title_en: string } | null
}

export type PartnerInquiryStatus = 'new' | 'contacted' | 'in_discussion' | 'closed'

/** An inbound lead from a business/person asking to become a WEEMAP partner, submitted via the public /partner page form.
 *  NOT the same as ExperiencePartner — that's an operational partner already onboarded to Signature Experiences. */
export interface PartnerInquiry {
  id: string
  name: string
  business_name?: string | null
  phone: string
  email?: string | null
  partnership_type?: string | null
  message?: string | null
  status: PartnerInquiryStatus
  created_at: string
}
