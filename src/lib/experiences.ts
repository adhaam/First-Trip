// ─── Signature Experiences: shared types + pure helpers ───
//
// Everything here is framework-free and side-effect-free so it can be imported
// from server components, API routes and client components alike.
// Data fetching lives in `src/lib/data.ts`; validation schemas in the routes.

export const EXPERIENCE_STATUSES = ['draft', 'published'] as const
export type ExperienceStatus = (typeof EXPERIENCE_STATUSES)[number]

export const EXPERIENCE_CURRENCIES = ['EGP', 'USD'] as const
export type ExperienceCurrency = (typeof EXPERIENCE_CURRENCIES)[number]

export const EXPERIENCE_DATE_STATUSES = ['open', 'cancelled'] as const
export type ExperienceDateStatus = (typeof EXPERIENCE_DATE_STATUSES)[number]

export const EXPERIENCE_BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled'] as const
export type ExperienceBookingStatus = (typeof EXPERIENCE_BOOKING_STATUSES)[number]

export interface ExperienceCategory {
  slug: string
  label_ar: string
  label_en: string
  sort_order: number
}

/** Seeded in migration 016 — mirrored here so the UI has labels before a fetch. */
export const DEFAULT_EXPERIENCE_CATEGORIES: ExperienceCategory[] = [
  { slug: 'diving', label_ar: 'غوص', label_en: 'Diving', sort_order: 10 },
  { slug: 'kite-surf', label_ar: 'كايت سيرف', label_en: 'Kite Surf', sort_order: 20 },
  { slug: 'yoga', label_ar: 'يوجا', label_en: 'Yoga', sort_order: 30 },
  { slug: 'photography', label_ar: 'تصوير', label_en: 'Photography', sort_order: 40 },
  { slug: 'hiking', label_ar: 'هايكنج وتخييم', label_en: 'Hiking & Camping', sort_order: 50 },
  { slug: 'adventure', label_ar: 'مغامرة', label_en: 'Adventure', sort_order: 60 },
  { slug: 'solo-friendly', label_ar: 'مناسب للسولو', label_en: 'Solo Friendly', sort_order: 70 },
  { slug: 'other', label_ar: 'أخرى', label_en: 'Other', sort_order: 80 },
]

export interface ItineraryDay {
  day: number
  title_ar: string
  title_en: string
  description_ar: string
  description_en: string
}

export interface Experience {
  id: string
  slug: string
  title_ar: string
  title_en: string
  category: string
  partner_name: string
  partner_description_ar: string
  partner_description_en: string
  short_description_ar: string
  short_description_en: string
  full_description_ar: string
  full_description_en: string
  included_ar: string[]
  included_en: string[]
  not_included_ar: string[]
  not_included_en: string[]
  itinerary: ItineraryDay[]
  hero_image: string
  gallery: string[]
  duration_ar: string
  duration_en: string
  price: number
  currency: ExperienceCurrency
  status: ExperienceStatus
  sort_order: number
  discount_value?: number | null
  discount_type?: 'amount' | 'percentage' | null
  discount_label?: string
  created_at: string
  updated_at?: string
}

export interface ExperienceDate {
  id: string
  experience_id: string
  start_date: string
  end_date: string
  total_spots: number
  status: ExperienceDateStatus
  is_open: boolean
  price_override: number | null
  created_at: string
}

/** An `ExperienceDate` joined with the derived availability numbers. */
export interface ExperienceDateWithAvailability extends ExperienceDate {
  spots_taken: number
  spots_remaining: number
  /** Derived: bookable right now by a public visitor. */
  is_bookable: boolean
  is_sold_out: boolean
}

export interface ExperienceBooking {
  id: string
  experience_id: string
  experience_date_id: string
  customer_id: string | null
  full_name: string
  phone: string
  email: string
  spots_requested: number
  notes: string
  quoted_price: number | null
  currency: string
  status: ExperienceBookingStatus
  source: string
  created_at: string
}

export interface ExperienceWithDates extends Experience {
  dates: ExperienceDateWithAvailability[]
}

// ─── Helpers ───

/**
 * URL-safe slug. Arabic letters are kept (Next.js and modern browsers handle
 * percent-encoded paths fine), so an Arabic-only title still yields a readable
 * slug instead of an empty string.
 */
export function slugifyExperience(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{Letter}\p{Number}-]+/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '')
}

export function isSoldOut(date: Pick<ExperienceDateWithAvailability, 'spots_remaining'>): boolean {
  return date.spots_remaining <= 0
}

/** Public visitors may only book an open, non-cancelled, future date with room. */
export function isDateBookable(
  date: Pick<ExperienceDate, 'is_open' | 'status' | 'end_date'>,
  spotsRemaining: number,
  now: Date = new Date(),
): boolean {
  if (!date.is_open || date.status !== 'open') return false
  if (spotsRemaining <= 0) return false
  return !isPastDate(date.end_date, now)
}

export function isPastDate(endDate: string, now: Date = new Date()): boolean {
  const end = new Date(`${endDate}T23:59:59`)
  if (Number.isNaN(end.getTime())) return false
  return end.getTime() < now.getTime()
}

/** Attaches derived availability to a raw date row. */
export function withAvailability(
  date: ExperienceDate,
  spotsTaken: number,
  now: Date = new Date(),
): ExperienceDateWithAvailability {
  const spots_remaining = Math.max(date.total_spots - spotsTaken, 0)
  return {
    ...date,
    spots_taken: spotsTaken,
    spots_remaining,
    is_sold_out: spots_remaining <= 0,
    is_bookable: isDateBookable(date, spots_remaining, now),
  }
}

/** Inclusive night/day count for a date range. */
export function durationNights(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000))
}

/**
 * Admin-set duration wins; otherwise it is derived from the next available
 * date so a card never shows a blank duration.
 */
export function formatDuration(
  experience: Pick<Experience, 'duration_ar' | 'duration_en'>,
  date: Pick<ExperienceDate, 'start_date' | 'end_date'> | null,
  locale: string,
): string {
  const ar = locale === 'ar'
  const manual = (ar ? experience.duration_ar : experience.duration_en).trim()
  if (manual) return manual
  if (!date) return ''
  const nights = durationNights(date.start_date, date.end_date)
  const days = nights + 1
  if (nights === 0) return ar ? 'يوم واحد' : 'Day trip'
  if (ar) return `${days} أيام / ${nights} ليالٍ`
  return `${days} days / ${nights} ${nights === 1 ? 'night' : 'nights'}`
}

export function formatDateRange(startDate: string, endDate: string, locale: string): string {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return ''
  const tag = locale === 'ar' ? 'ar-EG' : 'en-GB'
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()
  const startLabel = start.toLocaleDateString(tag, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString(tag, { day: 'numeric', month: 'short', year: 'numeric' })
  if (startDate === endDate) return endLabel
  return `${startLabel} – ${endLabel}`
}

export function formatPrice(price: number, currency: string, locale: string): string {
  const amount = Number.isFinite(price) ? price : 0
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(amount)
  if (currency === 'USD') return `$${formatted}`
  return locale === 'ar' ? `${formatted} ج.م` : `${formatted} EGP`
}

export function categoryLabel(
  slug: string,
  categories: ExperienceCategory[],
  locale: string,
): string {
  const match = categories.find((c) => c.slug === slug)
  if (!match) return slug
  return locale === 'ar' ? match.label_ar : match.label_en
}

/** The soonest date a visitor could still join; falls back to the next future date. */
export function nextAvailableDate(
  dates: ExperienceDateWithAvailability[],
  now: Date = new Date(),
): ExperienceDateWithAvailability | null {
  const upcoming = dates
    .filter((d) => d.status !== 'cancelled' && !isPastDate(d.end_date, now))
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
  return upcoming.find((d) => d.is_bookable) ?? upcoming[0] ?? null
}

export function localized(row: object, field: string, locale: string): string {
  const source = row as Record<string, unknown>
  const primary = source[`${field}_${locale === 'ar' ? 'ar' : 'en'}`]
  const fallback = source[`${field}_${locale === 'ar' ? 'en' : 'ar'}`]
  return String(primary || fallback || '')
}

export function localizedList(row: object, field: string, locale: string): string[] {
  const source = row as Record<string, unknown>
  const primary = source[`${field}_${locale === 'ar' ? 'ar' : 'en'}`]
  const fallback = source[`${field}_${locale === 'ar' ? 'en' : 'ar'}`]
  const list = Array.isArray(primary) && primary.length ? primary : fallback
  return Array.isArray(list) ? list.filter(Boolean).map(String) : []
}
