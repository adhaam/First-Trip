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
