import type { MetadataRoute } from 'next'
import { getAccommodations, getSinaiTrips, getCommerceProducts, getCommunityPosts } from '@/lib/data'
import { getTripPackages } from '@/lib/trip-packages'
import { getExperiences } from '@/lib/experiences'
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
  { path: '/sinai-trips/packages', priority: 0.7, changeFrequency: 'weekly' },
  // Explore is the doorway into Trips/Packages/Community — indexable hub page.
  { path: '/explore', priority: 0.6, changeFrequency: 'weekly' },
  // Signature Experiences is a top-level nav item, a homepage feature section
  // and a full product line with its own detail routes — it was absent here.
  { path: '/signature', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/community', priority: 0.7, changeFrequency: 'weekly' },
  // /plan (Build Your Trip) is a real, indexable destination when reached
  // with no prefill — the empty builder itself is a useful landing page.
  // A prefilled ?stay=/?trip=/?package= URL renders the same page for one
  // visitor's click-through, not distinct content, so only the bare path
  // goes in the sitemap; /plan/page.tsx's generateMetadata marks the
  // prefilled variant noindex,follow.
  { path: '/plan', priority: 0.5, changeFrequency: 'weekly' },
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
        lastModified: acc.updated_at ? new Date(acc.updated_at) : (acc.created_at ? new Date(acc.created_at) : new Date()),
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

  // Real trip package pages — bundles of Sinai trips, sold 100% after
  // confirmation. getTripPackages() already scopes to is_active only.
  const packages = await getTripPackages().catch(() => [])
  for (const locale of routing.locales) {
    for (const pkg of packages) {
      const path = `/sinai-trips/packages/${pkg.slug}`
      entries.push({
        url: localizedUrl(path, locale),
        lastModified: pkg.created_at ? new Date(pkg.created_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
        alternates: localizedAlternates(path),
      })
    }
  }

  // Real Signature Experience pages — getExperiences() already scopes to
  // status = 'published' only.
  const experiences = await getExperiences().catch(() => [])
  for (const locale of routing.locales) {
    for (const experience of experiences) {
      const path = `/signature/${experience.slug}`
      entries.push({
        url: localizedUrl(path, locale),
        lastModified: experience.updated_at ? new Date(experience.updated_at) : new Date(experience.created_at),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        alternates: localizedAlternates(path),
      })
    }
  }

  // Real community post pages — same pattern as accommodations/trips above.
  // Posts without a slug (pre-migration-019 rows, or the DB where that
  // migration hasn't been applied yet) are skipped rather than emitting a
  // broken sitemap URL.
  const communityPosts = await getCommunityPosts().catch(() => [])
  for (const locale of routing.locales) {
    for (const post of communityPosts) {
      if (!post.slug) continue
      const path = `/community/${post.slug}`
      entries.push({
        url: localizedUrl(path, locale),
        lastModified: post.updated_at ? new Date(post.updated_at) : (post.created_at ? new Date(post.created_at) : new Date()),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        alternates: localizedAlternates(path),
      })
    }
  }

  // Real commerce product pages — same pattern as accommodations/trips above.
  const [merchProducts, rentalProducts] = await Promise.all([
    getCommerceProducts('sale').catch(() => []),
    getCommerceProducts('rental').catch(() => []),
  ])
  for (const locale of routing.locales) {
    for (const product of merchProducts) {
      const path = `/merch/${product.slug}`
      entries.push({
        url: localizedUrl(path, locale),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        alternates: localizedAlternates(path),
      })
    }
    for (const product of rentalProducts) {
      const path = `/rent/${product.slug}`
      entries.push({
        url: localizedUrl(path, locale),
        changeFrequency: 'weekly' as const,
        priority: 0.6,
        alternates: localizedAlternates(path),
      })
    }
  }

  return entries
}
