import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://weemapsinai.com'

export default function sitemap(): MetadataRoute.Sitemap {
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

  // Book Dahab product pages (from mock data)
  const productIds = ['1', '2', '3', '4']
  for (const locale of locales) {
    for (const id of productIds) {
      entries.push({
        url: `${BASE_URL}/${locale}/book-dahab/${id}`,
        lastModified: new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.8,
      })
    }
  }

  return entries
}