// ─── site_pages — pure types/helpers, no server-only/Supabase import ───
// Split out from site-pages.ts so these are unit-testable directly, the same
// convention as order-core.ts/booking-sources.ts/customer-resolution.ts.

export const PAGE_KEYS = [
  'home',
  'stay',
  'explore',
  'sinai_trips',
  'packages',
  'experiences',
  'shop',
  'rent',
  'community',
] as const

export type PageKey = (typeof PAGE_KEYS)[number]

export type PageFields = {
  eyebrow: boolean
  title: boolean
  body: boolean
  image: boolean
}

export const PAGE_FIELDS: Record<PageKey, PageFields> = {
  home: { eyebrow: false, title: false, body: true, image: true },
  stay: { eyebrow: true, title: true, body: true, image: true },
  explore: { eyebrow: true, title: true, body: true, image: true },
  sinai_trips: { eyebrow: true, title: true, body: true, image: true },
  packages: { eyebrow: true, title: true, body: true, image: true },
  experiences: { eyebrow: true, title: true, body: true, image: true },
  shop: { eyebrow: true, title: true, body: true, image: true },
  rent: { eyebrow: true, title: true, body: true, image: true },
  community: { eyebrow: true, title: true, body: true, image: true },
}

export interface SitePage {
  page_key: PageKey
  hero_image_url: string | null
  hero_image_alt_en: string | null
  hero_image_alt_ar: string | null
  eyebrow_en: string | null
  eyebrow_ar: string | null
  title_en: string | null
  title_ar: string | null
  body_en: string | null
  body_ar: string | null
  updated_at: string
  updated_by: string | null
}

export function isPageKey(value: string): value is PageKey {
  return (PAGE_KEYS as readonly string[]).includes(value)
}

export function isAllowedMediaUrl(value: string): boolean {
  if (!value) return true
  if (value.startsWith('/') && !value.startsWith('//')) return true
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export function isHeroUrlAcceptable(next: string, stored: string | null | undefined): boolean {
  return isAllowedMediaUrl(next) || next === stored
}

/**
 * Picks the owner override for the current locale when set, else the
 * designed i18n fallback. Every column on site_pages is nullable — an empty
 * string or whitespace-only override is treated the same as null.
 */
export function pickCopy(
  locale: string,
  override: { en: string | null | undefined; ar: string | null | undefined },
  fallback: string,
): string {
  const ar = locale === 'ar'
  const picked = ar ? override.ar : override.en
  return picked && picked.trim().length > 0 ? picked : fallback
}

/** Hero image: owner override when set, else the page's designed static fallback. Never a catalogue[0] image. */
export function pickHeroImage(sitePage: SitePage | null, fallback: string): string {
  return sitePage?.hero_image_url || fallback
}
