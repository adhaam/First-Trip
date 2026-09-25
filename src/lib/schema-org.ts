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
  const instagram = settings?.instagram_url || 'https://instagram.com/weemapsinai/'

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
    logo: `${SITE_URL}/brand/logo.png`,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Dahab',
      addressRegion: 'South Sinai',
      addressCountry: 'EG',
    },
    // No `geo`: WEEMAP has no verified business coordinates on record, and a
    // town-centre point would claim a precise location that isn't real.
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

export function getArticleSchema(article: {
  title: string
  description: string
  image: string
  datePublished: string
  /** Real `updated_at` when the row has one — falls back to datePublished, never invented. */
  dateModified?: string | null
  url: string
  inLanguage: string
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.title,
    description: article.description,
    image: article.image,
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    inLanguage: article.inLanguage,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': article.url,
    },
    url: article.url,
    publisher: {
      '@type': 'Organization',
      name: 'WEEMAP SINAI',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/brand/logo.png`,
      },
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

/**
 * Sitewide WebSite entity. `searchUrlTemplate` is only passed once a real
 * public search RESULTS page exists at that URL (`/[locale]/search?q=`) —
 * without it, `potentialAction` is omitted entirely rather than pointing at
 * a page that doesn't exist.
 */
export function getWebSiteSchema(opts: { locale: string; searchUrlTemplate?: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'WEEMAP SINAI',
    inLanguage: opts.locale,
    ...(opts.searchUrlTemplate
      ? {
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: opts.searchUrlTemplate },
            'query-input': 'required name=search_term_string',
          },
        }
      : {}),
  }
}

/** BreadcrumbList for a detail page. `items` is the real navigation trail shown on the page, root first. */
export function getBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  }
}

/**
 * CollectionPage for a list page that renders real entities (trips,
 * accommodations, products, …). `items` must be EXACTLY the entities the
 * page actually rendered, in the order shown — never a superset/subset and
 * never prices or facts not already visible on the page. Empty `items`
 * still produces a valid, empty ItemList (the empty-catalogue state).
 */
export function getCollectionPageSchema(input: {
  name: string
  description?: string | null
  url: string
  items: { name: string; url: string }[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    url: input.url,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: input.items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  }
}

/**
 * Stay detail page. `address`/`priceRange` are only included when derived
 * from real DB fields the page actually shows — never invented when the
 * accommodation row doesn't carry them.
 */
export function getLodgingBusinessSchema(input: {
  name: string
  description: string
  url: string
  image?: string | null
  address?: { locality: string; region?: string | null; country?: string } | null
  priceRange?: string | null
  ratingValue?: number | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(input.address
      ? {
          address: {
            '@type': 'PostalAddress',
            addressLocality: input.address.locality,
            ...(input.address.region ? { addressRegion: input.address.region } : {}),
            addressCountry: input.address.country || 'EG',
          },
        }
      : {}),
    ...(input.priceRange ? { priceRange: input.priceRange } : {}),
    ...(input.ratingValue
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: input.ratingValue, reviewCount: 1, bestRating: 5 } }
      : {}),
  }
}

/**
 * Sinai trip / trip package / Signature experience detail page. `offers` is
 * only included when the page itself shows that price — a package's
 * per-trip breakdown is never surfaced here (src/lib/trip-packages.ts
 * strips it from every surface except the operator-only detail fetch).
 */
export function getTouristTripSchema(input: {
  name: string
  description: string
  url: string
  image?: string | null
  offers?: { price: number; priceCurrency?: string } | null
  itinerary?: { name: string; description?: string }[] | null
  touristType?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(input.offers
      ? { offers: { '@type': 'Offer', price: input.offers.price, priceCurrency: input.offers.priceCurrency || 'EGP' } }
      : {}),
    ...(input.itinerary && input.itinerary.length > 0
      ? {
          itinerary: {
            '@type': 'ItemList',
            itemListElement: input.itinerary.map((step, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: step.name,
              ...(step.description ? { description: step.description } : {}),
            })),
          },
        }
      : {}),
    ...(input.touristType ? { touristType: input.touristType } : {}),
  }
}

/**
 * Merch / rental product detail page. `availability` must be derived from
 * real inventory (in stock vs out of stock / unavailable for these dates),
 * never assumed InStock.
 */
export function getCommerceProductSchema(input: {
  name: string
  description: string
  url: string
  image?: string | null
  price: number
  priceCurrency?: string
  availability: 'InStock' | 'OutOfStock'
  sku?: string | null
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    url: input.url,
    ...(input.image ? { image: input.image } : {}),
    ...(input.sku ? { sku: input.sku } : {}),
    offers: {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.priceCurrency || 'EGP',
      availability: `https://schema.org/${input.availability}`,
      url: input.url,
    },
  }
}
