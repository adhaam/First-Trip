import type { MetadataRoute } from 'next'
import { getAccommodations, getSinaiTrips } from '@/lib/data'
import { getPathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { SITE_URL } from '@/lib/seo'
import { getTripRouteSlug } from '@/lib/trips'

// Locale-agnostic route paths → `getPathname` resolves the correctly
// prefixed URL per locale (Arabic — the default locale — has NO `/ar`
// prefix under `localePrefix: 'as-needed'`; English is served under `/en`).
// Building these by hand (`/${locale}${page}`) previously produced `/ar/...`
// URLs that don't actually resolve — fixed here.
const STATIC_PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/book-dahab', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/sinai-trips', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/community', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/partner', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/about', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/policy', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/merch', priority: 0.5, changeFrequency: 'weekly' },
  { path: '/rent', priority: 0.5, changeFrequency: 'weekly' },
]

function localizedUrl(path: string, locale: string): string {
  return `${SITE_URL}${getPathname({ href: path, locale })}`
}

function localizedAlternates(path: string) {
  return {
    languages: {
      ...Object.fromEntries(routing.locales.map(locale => [locale, localizedUrl(path, locale)])),
      'x-default': localizedUrl(path, routing.defaultLocale),
    },
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = []

  for (const locale of routing.locales) {
    for (const { path, priority, changeFrequency } of STATIC_PAGES) {
      entries.push({
        url: localizedUrl(path, locale),
        lastModified: new Date(),
        changeFrequency,
        priority,
        alternates: localizedAlternates(path),
      })
    }
  }

  // Real accommodation detail pages — never hardcode ids here, the list
  // changes as the owner adds/removes properties from the dashboard.
  const [accommodations, trips] = await Promise.all([
    getAccommodations().catch(() => []),
    getSinaiTrips().catch(() => []),
  ])
  for (const locale of routing.locales) {
    for (const acc of accommodations) {
      entries.push({
        url: localizedUrl(`/book-dahab/${acc.id}`, locale),
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        alternates: localizedAlternates(`/book-dahab/${acc.id}`),
      })
    }
  }

  for (const locale of routing.locales) {
    for (const trip of trips) {
      const path = `/sinai-trips/${getTripRouteSlug(trip)}`
      entries.push({
        url: localizedUrl(path, locale),
        lastModified: trip.created_at ? new Date(trip.created_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        alternates: localizedAlternates(path),
      })
    }
  }

  return entries
}
