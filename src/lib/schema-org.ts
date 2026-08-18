import { PHONE_NUMBER } from './constants'
import { SITE_URL } from './seo'
import type { SiteSettings } from './types'

/**
 * Organization JSON-LD. `settings` is Site Settings from the dashboard —
 * when passed, phone/social links reflect what the owner actually
 * configured; the constant fallbacks below are the real, currently
 * operating WEEMAP contact channels (same fallback used by the footer and
 * the floating WhatsApp button), never a fabricated placeholder.
 */
export function getSchemaOrg(settings?: SiteSettings | null) {
  const phone = settings?.phone_number || PHONE_NUMBER
  const instagram = settings?.instagram_url || 'https://www.instagram.com/weemapeg/'

  return {
    '@context': 'https://schema.org',
    '@type': 'TourismBusiness',
    '@id': `${SITE_URL}/#organization`,
    name: settings?.organization_name || 'WEEMAP SINAI',
    alternateName: 'WEEMAP SINAI',
    description: {
      '@language': 'ar',
      '@value': 'منصة سفر محلية في سيناء متخصصة في الباقات الشاملة، حجز الفنادق والشاليهات والكمبات، والرحلات الداخلية في جنوب سيناء',
    },
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dahab',
      addressRegion: 'South Sinai',
      addressCountry: 'EG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 28.5092,
      longitude: 34.5185,
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: phone,
      availableLanguage: ['Arabic', 'English'],
    },
    // Verified/owner-configured channels only — see
    // _weemap_reference/06_business-info/WEEMAP_INFO.md. Facebook only
    // appears once set in Site Settings; never invented.
    sameAs: [instagram, ...(settings?.facebook_url ? [settings.facebook_url] : [])],
    areaServed: {
      '@type': 'City',
      name: 'Dahab, South Sinai, Egypt',
    },
  }
}

export function getProductSchema(accommodation: {
  name: string
  description: string
  image: string
  price: number
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: accommodation.name,
    description: accommodation.description,
    image: accommodation.image,
    offers: {
      '@type': 'Offer',
      price: accommodation.price,
      priceCurrency: 'EGP',
    },
  }
}
