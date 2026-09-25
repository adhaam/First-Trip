import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  getBreadcrumbSchema,
  getCommerceProductSchema,
  getLodgingBusinessSchema,
  getTouristTripSchema,
  getWebSiteSchema,
} from './schema-org'
import { jsonLdScript } from './safe-html'

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
