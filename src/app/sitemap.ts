import type { MetadataRoute } from 'next'
import { getAccommodations } from '@/lib/data'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://weemapsinai.com'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const locales = ['ar', 'en']

  // Static pages
  const staticPages = [
    '',
    '/book-dahab',
    '/sinai-trips',
    '/community',
    '/partner',
    '/about',
    '/policy',
  ]

  const entries: MetadataRoute.Sitemap = []

  for (const locale of locales) {
    for (const page of staticPages) {
      entries.push({
        url: `${BASE_URL}/${locale}${page}`,
        lastModified: new Date(),
        changeFrequency: page === '' ? 'daily' : 'weekly',
        priority: page === '' ? 1 : page === '/book-dahab' ? 0.9 : 0.7,
      })
    }
  }

  // Real accommodation detail pages — never hardcode ids here, the list
  // changes as the owner adds/removes properties from the dashboard.
  const accommodations = await getAccommodations().catch(() => [])
  for (const locale of locales) {
    for (const acc of accommodations) {
      entries.push({
        url: `${BASE_URL}/${locale}/book-dahab/${acc.id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })
    }
  }

  return entries
}