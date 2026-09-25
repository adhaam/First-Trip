import type { Metadata } from 'next'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://weemapsinai.com'

/**
 * Canonical + hreflang alternates for a locale-agnostic route.
 *
 * `routing.localePrefix` is `'as-needed'`: the default locale (Arabic) is
 * served with NO `/ar` prefix, English is served under `/en`. There is no
 * per-locale `pathnames` map configured (see `src/i18n/routing.ts`), so a
 * route's segment names are identical in both locales — only the locale
 * prefix differs. `getPathname` (from `next-intl/navigation`) is next-intl's
 * own helper for building that correctly per locale, so nothing here
 * hand-rolls prefix logic.
 *
 * `pathname` is the LOCALE-AGNOSTIC path, e.g. `/about`,
 * `/book-dahab/<accommodation-id>`, or `/` for the homepage.
 */
export function buildAlternates(pathname: string, locale: string): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of routing.locales) {
    languages[l] = `${SITE_URL}${getPathname({ href: pathname, locale: l })}`
  }
  // x-default → the default-locale (Arabic) URL: what a visitor with no
  // locale preference lands on via the middleware's Accept-Language detection.
  languages['x-default'] = `${SITE_URL}${getPathname({ href: pathname, locale: routing.defaultLocale })}`

  return {
    canonical: `${SITE_URL}${getPathname({ href: pathname, locale })}`,
    languages,
  }
}

/**
 * The sitewide fallback social image — same path the root layout falls back
 * to (`settings?.social_share_image || '/media/og-cover.jpg'`,
 * src/app/[locale]/layout.tsx). Metadata is only **shallowly** merged
 * across a route's segments (root layout → page): when a page defines its
 * own `openGraph`, that whole object REPLACES the layout's, it does not
 * deep-merge field by field (see
 * node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md
 * "Merging" / "Overwriting fields"). So a page-level `openGraph` with no
 * `images` produces NO og:image at all, not the layout's default — this
 * constant is what `pageMetadata()` falls back to instead, so every public
 * page keeps a real og:image.
 */
export const DEFAULT_OG_IMAGE = '/media/og-cover.jpg'

/**
 * Full page-level Metadata for a public route: canonical + hreflang
 * (`buildAlternates`), Open Graph and Twitter Card. Built once here so
 * every public page (list and detail) gets the same real `og:url` (the
 * page's own canonical, not the sitewide default) and `og:locale`, instead
 * of silently inheriting the root layout's site-default title/description/
 * url via the shallow-merge behaviour described on `DEFAULT_OG_IMAGE`.
 *
 * `image` should be the entity's own real photo when the page has one
 * (never stock/other-place imagery — pass `NEUTRAL_MEDIA` instead when an
 * entity has no photo of its own); omitted entirely, it falls back to
 * `DEFAULT_OG_IMAGE`, never to "no image".
 */
export function pageMetadata(opts: {
  locale: string
  /** Locale-agnostic path, e.g. `/sinai-trips` or `/book-dahab/<id>`. */
  path: string
  title: string
  description: string
  image?: string | null
  robots?: Metadata['robots']
  siteName?: string
}): Metadata {
  const ar = opts.locale === 'ar'
  const alternates = buildAlternates(opts.path, opts.locale)
  const canonicalUrl = `${SITE_URL}${getPathname({ href: opts.path, locale: opts.locale })}`
  const image = opts.image || `${SITE_URL}${DEFAULT_OG_IMAGE}`

  return {
    title: opts.title,
    description: opts.description,
    alternates,
    ...(opts.robots ? { robots: opts.robots } : {}),
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: canonicalUrl,
      siteName: opts.siteName || 'WEEMAP SINAI',
      type: 'website',
      locale: ar ? 'ar_EG' : 'en_US',
      alternateLocale: ar ? 'en_US' : 'ar_EG',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: opts.title,
      description: opts.description,
      images: [image],
    },
  }
}

export const DEFAULT_SITE_TITLE = 'WEEMAP SINAI — We map Sinai. You live it.'
const DEFAULT_SITE_DESC_AR =
  'WEEMAP SINAI — باقات، إقامة، انتقالات، ورحلات سيناء. بنرسم لك الطريق لدهب وجنوب سيناء — إنت بس تعيشها.'
const DEFAULT_SITE_DESC_EN =
  'WEEMAP SINAI — packages, stays, transfers, and Sinai trips. We map the way; you live it.'

/** Sitewide title/description: the owner's Site Settings → SEO values, else the WEEMAP defaults. */
export function siteSeo(
  settings: { seo_title?: string | null; seo_description_ar?: string | null; seo_description_en?: string | null } | null,
  locale: string,
): { title: string; description: string } {
  const ar = locale === 'ar'
  return {
    title: settings?.seo_title || DEFAULT_SITE_TITLE,
    description: (ar ? settings?.seo_description_ar : settings?.seo_description_en)
      || (ar ? DEFAULT_SITE_DESC_AR : DEFAULT_SITE_DESC_EN),
  }
}
