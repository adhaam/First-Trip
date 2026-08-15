import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Both locale forms of /admin — 'ar' has no prefix under
      // localePrefix: 'as-needed', 'en' is served under /en.
      disallow: ['/admin/', '/en/admin/', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}