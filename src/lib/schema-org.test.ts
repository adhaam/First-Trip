import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBreadcrumbSchema,
  getCollectionPageSchema,
  getCommerceProductSchema,
  getLodgingBusinessSchema,
  getTouristTripSchema,
  getWebSiteSchema,
} from './schema-org'
import { jsonLdScript } from './safe-html'
import { SITE_URL } from './seo'
import { getPathname } from '@/i18n/navigation'

test('getWebSiteSchema omits potentialAction when no search URL is given', () => {
  const schema = getWebSiteSchema({ locale: 'ar' })
  assert.equal('potentialAction' in schema, false)
})

test('getWebSiteSchema includes SearchAction only when a real search URL template is passed', () => {
  const schema = getWebSiteSchema({ locale: 'en', searchUrlTemplate: 'https://weemapsinai.com/en/search?q={search_term_string}' })
  assert.equal(schema.potentialAction?.['@type'], 'SearchAction')
  assert.equal(schema.potentialAction?.target.urlTemplate, 'https://weemapsinai.com/en/search?q={search_term_string}')
})

test('getBreadcrumbSchema numbers items from 1 in the given order', () => {
  const schema = getBreadcrumbSchema([
    { name: 'Home', url: 'https://weemapsinai.com' },
    { name: 'Stay', url: 'https://weemapsinai.com/book-dahab' },
  ])
  assert.equal(schema.itemListElement.length, 2)
  assert.equal(schema.itemListElement[0].position, 1)
  assert.equal(schema.itemListElement[1].position, 2)
  assert.equal(schema.itemListElement[1].name, 'Stay')
})

test('getLodgingBusinessSchema never fabricates address or priceRange when not given', () => {
  const schema = getLodgingBusinessSchema({
    name: 'Sea Breeze Bedouin Camp',
    description: 'A camp in Dahab.',
    url: 'https://weemapsinai.com/book-dahab/a1',
  })
  assert.equal('address' in schema, false)
  assert.equal('priceRange' in schema, false)
  assert.equal('image' in schema, false)
  assert.equal('aggregateRating' in schema, false)
})

test('getLodgingBusinessSchema includes address only when a real locality is passed', () => {
  const schema = getLodgingBusinessSchema({
    name: 'Blue Lagoon Chalets',
    description: 'Chalets on the lagoon.',
    url: 'https://weemapsinai.com/book-dahab/a2',
    address: { locality: 'Dahab', region: 'South Sinai', country: 'EG' },
  })
  assert.deepEqual(schema.address, {
    '@type': 'PostalAddress',
    addressLocality: 'Dahab',
    addressRegion: 'South Sinai',
    addressCountry: 'EG',
  })
})

test('getTouristTripSchema omits offers when the page shows no price', () => {
  const schema = getTouristTripSchema({
    name: 'Blue Hole Snorkel',
    description: 'A snorkel trip.',
    url: 'https://weemapsinai.com/sinai-trips/blue-hole-snorkel-b1',
  })
  assert.equal('offers' in schema, false)
})

test('getTouristTripSchema includes offers with the real price and EGP currency when given', () => {
  const schema = getTouristTripSchema({
    name: 'Blue Hole Snorkel',
    description: 'A snorkel trip.',
    url: 'https://weemapsinai.com/sinai-trips/blue-hole-snorkel-b1',
    offers: { price: 900 },
  })
  assert.deepEqual(schema.offers, { '@type': 'Offer', price: 900, priceCurrency: 'EGP' })
})

test('getCommerceProductSchema reflects real availability, never assumes InStock', () => {
  const outOfStock = getCommerceProductSchema({
    name: 'Diving Mask',
    description: 'A diving mask for sale.',
    url: 'https://weemapsinai.com/merch/diving-mask',
    price: 350,
    availability: 'OutOfStock',
  })
  assert.equal(outOfStock.offers.availability, 'https://schema.org/OutOfStock')
})

test('jsonLdScript escapes </script> so stored text cannot close the JSON-LD tag', () => {
  const malicious = getTouristTripSchema({
    name: '</script><script>alert(1)</script>',
    description: 'desc',
    url: 'https://weemapsinai.com/sinai-trips/x',
  })
  const script = jsonLdScript(malicious)
  assert.equal(script.includes('</script>'), false)
  assert.equal(script.includes('<script>alert'), false)
  // Still valid, faithful JSON once parsed.
  assert.equal(JSON.parse(script).name, '</script><script>alert(1)</script>')
})

test('jsonLdScript escapes line-separator characters that some JS parsers treat as line terminators', () => {
  const schema = getBreadcrumbSchema([{ name: 'Line Sep', url: 'https://weemapsinai.com' }])
  const script = jsonLdScript(schema)
  assert.equal(script.includes(' '), false)
  assert.equal(JSON.parse(script).itemListElement[0].name, 'Line Sep')
})

test('getCollectionPageSchema produces a valid, empty ItemList for an empty catalogue', () => {
  const schema = getCollectionPageSchema({
    name: 'Sinai Trip Packages',
    description: 'Bundled Sinai trips.',
    url: 'https://weemapsinai.com/sinai-trips/packages',
    items: [],
  })
  assert.equal(schema['@type'], 'CollectionPage')
  assert.equal(schema.mainEntity['@type'], 'ItemList')
  assert.deepEqual(schema.mainEntity.itemListElement, [])
})

test('getCollectionPageSchema numbers items from 1 in the given order, matching what is rendered', () => {
  const schema = getCollectionPageSchema({
    name: 'Sinai Trips',
    url: 'https://weemapsinai.com/sinai-trips',
    items: [
      { name: 'Blue Hole Snorkel', url: 'https://weemapsinai.com/sinai-trips/blue-hole-snorkel-a1' },
      { name: 'Colored Canyon Hike', url: 'https://weemapsinai.com/sinai-trips/colored-canyon-hike-b2' },
    ],
  })
  assert.equal(schema.mainEntity.itemListElement.length, 2)
  assert.equal(schema.mainEntity.itemListElement[0].position, 1)
  assert.equal(schema.mainEntity.itemListElement[0].name, 'Blue Hole Snorkel')
  assert.equal(schema.mainEntity.itemListElement[1].position, 2)
  assert.equal(schema.mainEntity.itemListElement[1].name, 'Colored Canyon Hike')
})

test('getCollectionPageSchema omits description when none is given', () => {
  const schema = getCollectionPageSchema({
    name: 'Rent in Dahab',
    url: 'https://weemapsinai.com/rent',
    items: [],
  })
  assert.equal('description' in schema, false)
})

test('jsonLdScript escapes HTML/JSON-breaking characters in an item name (<, &, quotes) without corrupting the value', () => {
  const schema = getCollectionPageSchema({
    name: 'Merch',
    url: 'https://weemapsinai.com/merch',
    items: [
      { name: 'Dive Mask <script>alert("x")</script> & "Fins"', url: 'https://weemapsinai.com/merch/dive-mask' },
    ],
  })
  const script = jsonLdScript(schema)
  assert.equal(script.includes('</script>'), false)
  assert.equal(script.includes('<script>'), false)
  assert.equal(script.includes('&'), false)
  const parsed = JSON.parse(script)
  assert.equal(
    parsed.mainEntity.itemListElement[0].name,
    'Dive Mask <script>alert("x")</script> & "Fins"',
  )
})

test('getCollectionPageSchema: Arabic (default locale) item URLs have no /ar prefix, English URLs are under /en', () => {
  const arUrl = `${SITE_URL}${getPathname({ href: '/sinai-trips/blue-hole-snorkel-a1', locale: 'ar' })}`
  const enUrl = `${SITE_URL}${getPathname({ href: '/sinai-trips/blue-hole-snorkel-a1', locale: 'en' })}`
  assert.equal(arUrl, `${SITE_URL}/sinai-trips/blue-hole-snorkel-a1`)
  assert.equal(enUrl, `${SITE_URL}/en/sinai-trips/blue-hole-snorkel-a1`)

  const schema = getCollectionPageSchema({
    name: 'Sinai Trips',
    url: `${SITE_URL}/sinai-trips`,
    items: [{ name: 'Blue Hole Snorkel', url: arUrl }],
  })
  assert.equal(schema.mainEntity.itemListElement[0].url, arUrl)
  assert.notEqual(arUrl, enUrl)
})
