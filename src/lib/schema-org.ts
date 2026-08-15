export function getSchemaOrg() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TourismBusiness',
    '@id': 'https://weemapsinai.com/#organization',
    name: 'WEEMAP',
    alternateName: 'WEEMAP SINAI',
    description: {
      '@language': 'ar',
      '@value': 'منصة سفر محلية في سيناء متخصصة في الباقات الشاملة، حجز الفنادق والشاليهات والكمبات، والرحلات الداخلية في جنوب سيناء',
    },
    url: 'https://weemapsinai.com',
    logo: 'https://weemapsinai.com/logo.png',
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
      telephone: '+20-100-000-0000',
      availableLanguage: ['Arabic', 'English'],
    },
    sameAs: [
      // Verified channels only — see _weemap_reference/06_business-info/WEEMAP_INFO.md
      'https://www.instagram.com/weemapeg/',
    ],
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
      availability: 'https://schema.org/InStock',
    },
  }
}