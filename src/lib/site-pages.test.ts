import assert from 'node:assert/strict'
import test from 'node:test'
import {
  PAGE_FIELDS,
  PAGE_KEYS,
  isAllowedMediaUrl,
  isHeroUrlAcceptable,
  isPageKey,
  pickCopy,
  pickHeroImage,
  type SitePage,
} from './site-pages-core'

function page(overrides: Partial<SitePage> = {}): SitePage {
  return {
    page_key: 'stay',
    hero_image_url: null,
    hero_image_alt_en: null,
    hero_image_alt_ar: null,
    eyebrow_en: null,
    eyebrow_ar: null,
    title_en: null,
    title_ar: null,
    body_en: null,
    body_ar: null,
    updated_at: '2026-01-01T00:00:00Z',
    updated_by: null,
    ...overrides,
  }
}

test('isPageKey accepts every declared page key and rejects unknown strings', () => {
  for (const key of PAGE_KEYS) assert.equal(isPageKey(key), true)
  assert.equal(isPageKey('nope'), false)
  assert.equal(isPageKey(''), false)
})

test('PAGE_FIELDS covers every declared page key', () => {
  assert.deepEqual(Object.keys(PAGE_FIELDS).sort(), [...PAGE_KEYS].sort())
})

test('isAllowedMediaUrl accepts a local path', () => {
  assert.equal(isAllowedMediaUrl('/media/community.webp'), true)
})

test('isAllowedMediaUrl accepts a Supabase URL', () => {
  assert.equal(isAllowedMediaUrl('https://project.supabase.co/storage/v1/object/public/hero.webp'), true)
})

test('isHeroUrlAcceptable rejects a new external URL', () => {
  assert.equal(isHeroUrlAcceptable('https://commons.wikimedia.org/new.jpg', null), false)
})

test('isHeroUrlAcceptable accepts an unchanged external URL', () => {
  const url = 'https://commons.wikimedia.org/existing.jpg'
  assert.equal(isHeroUrlAcceptable(url, url), true)
})

test('isHeroUrlAcceptable accepts an empty URL', () => {
  assert.equal(isHeroUrlAcceptable('', 'https://commons.wikimedia.org/existing.jpg'), true)
})

test('pickCopy returns the locale override when non-empty', () => {
  assert.equal(pickCopy('en', { en: 'Custom title', ar: null }, 'Default'), 'Custom title')
  assert.equal(
    pickCopy('ar', { en: 'Custom title', ar: 'عنوان مخصص' }, 'الافتراضي'),
    'عنوان مخصص',
  )
})

test('pickCopy falls back to the designed default when the override is null, undefined, or blank', () => {
  assert.equal(pickCopy('en', { en: null, ar: null }, 'Default'), 'Default')
  assert.equal(pickCopy('en', { en: undefined, ar: undefined }, 'Default'), 'Default')
  assert.equal(pickCopy('en', { en: '   ', ar: null }, 'Default'), 'Default')
})

test('pickHeroImage prefers the owner override over the static fallback', () => {
  assert.equal(
    pickHeroImage(page({ hero_image_url: '/uploads/hero.webp' }), '/media/heroposter.webp'),
    '/uploads/hero.webp',
  )
})

test('pickHeroImage uses the static fallback when there is no row or no override set', () => {
  assert.equal(pickHeroImage(null, '/media/heroposter.webp'), '/media/heroposter.webp')
  assert.equal(pickHeroImage(page({ hero_image_url: null }), '/media/heroposter.webp'), '/media/heroposter.webp')
  assert.equal(pickHeroImage(page({ hero_image_url: '' }), '/media/heroposter.webp'), '/media/heroposter.webp')
})
