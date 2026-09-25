import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildAlternates, pageMetadata, SITE_URL, DEFAULT_OG_IMAGE } from './seo'

test('buildAlternates: Arabic (default locale) canonical has no /ar prefix', () => {
  const alternates = buildAlternates('/sinai-trips', 'ar')
  assert.equal(alternates?.canonical, `${SITE_URL}/sinai-trips`)
})

test('buildAlternates: English canonical is under /en', () => {
  const alternates = buildAlternates('/sinai-trips', 'en')
  assert.equal(alternates?.canonical, `${SITE_URL}/en/sinai-trips`)
})

test('buildAlternates: x-default points at the Arabic (default locale) URL', () => {
  const alternates = buildAlternates('/sinai-trips', 'en')
  const languages = alternates?.languages as Record<string, string>
  assert.equal(languages['x-default'], `${SITE_URL}/sinai-trips`)
  assert.equal(languages.ar, `${SITE_URL}/sinai-trips`)
  assert.equal(languages.en, `${SITE_URL}/en/sinai-trips`)
})

test('buildAlternates: homepage canonical has no trailing path segment beyond locale', () => {
  assert.equal(buildAlternates('/', 'ar')?.canonical, `${SITE_URL}/`)
  assert.equal(buildAlternates('/', 'en')?.canonical, `${SITE_URL}/en`)
})

test('pageMetadata: og:url matches the per-locale canonical, not the sitewide default', () => {
  const ar = pageMetadata({ locale: 'ar', path: '/sinai-trips', title: 't', description: 'd' })
  const en = pageMetadata({ locale: 'en', path: '/sinai-trips', title: 't', description: 'd' })
  assert.equal(ar.openGraph?.url, `${SITE_URL}/sinai-trips`)
  assert.equal(en.openGraph?.url, `${SITE_URL}/en/sinai-trips`)
})

test('pageMetadata: og:locale / alternateLocale flip correctly per locale', () => {
  const ar = pageMetadata({ locale: 'ar', path: '/explore', title: 't', description: 'd' })
  const en = pageMetadata({ locale: 'en', path: '/explore', title: 't', description: 'd' })
  assert.equal(ar.openGraph?.locale, 'ar_EG')
  assert.equal(ar.openGraph?.alternateLocale, 'en_US')
  assert.equal(en.openGraph?.locale, 'en_US')
  assert.equal(en.openGraph?.alternateLocale, 'ar_EG')
})

test('pageMetadata: falls back to the sitewide default OG image when none is given', () => {
  const meta = pageMetadata({ locale: 'en', path: '/community', title: 't', description: 'd' })
  assert.deepEqual(meta.openGraph?.images, [{ url: `${SITE_URL}${DEFAULT_OG_IMAGE}` }])
  assert.deepEqual(meta.twitter?.images, [`${SITE_URL}${DEFAULT_OG_IMAGE}`])
})

test('pageMetadata: uses the real entity image when one is passed, never the default', () => {
  const meta = pageMetadata({
    locale: 'en',
    path: '/sinai-trips/blue-hole-abc123',
    title: 't',
    description: 'd',
    image: 'https://cdn.example.com/real-trip-photo.jpg',
  })
  assert.deepEqual(meta.openGraph?.images, [{ url: 'https://cdn.example.com/real-trip-photo.jpg' }])
})

test('pageMetadata: alternates are present and match buildAlternates for the same path/locale', () => {
  const meta = pageMetadata({ locale: 'ar', path: '/book-dahab', title: 't', description: 'd' })
  assert.deepEqual(meta.alternates, buildAlternates('/book-dahab', 'ar'))
})

test('pageMetadata: robots is omitted by default (page is indexable)', () => {
  const meta = pageMetadata({ locale: 'ar', path: '/explore', title: 't', description: 'd' })
  assert.equal('robots' in meta, false)
})

test('pageMetadata: robots is passed through when given (e.g. noindex utility pages)', () => {
  const meta = pageMetadata({
    locale: 'ar', path: '/cart', title: 't', description: 'd', robots: { index: false, follow: true },
  })
  assert.deepEqual(meta.robots, { index: false, follow: true })
})
