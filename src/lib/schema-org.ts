export function getSchemaOrg() {
  return {
    '@context': 'https://schema.org',
    '@type': 'TourismBusiness',
    '@id': 'https://firsttrip-eg.com/#organization',
    name: 'First Trip',
    alternateName: 'First Trip Tourism Company',
    description: {
      '@language': 'ar',
      '@value': 'شركة سياحة في دهب متخصصة في الباقات الشاملة، حجز الفنادق والشاليهات والكمبات، والرحلات الداخلية في جنوب سيناء',
    },
    url: 'https://firsttrip-eg.com',
    logo: 'https://firsttrip-eg.com/logo.png',
    foundingDate: '2017',
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
      'https://facebook.com/firsttrip',
      'https://instagram.com/firsttrip',
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