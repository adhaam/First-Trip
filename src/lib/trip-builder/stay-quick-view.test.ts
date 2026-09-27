import assert from 'node:assert/strict'
import test from 'node:test'
import { stayQuickViewData } from './stay-quick-view'
import type { CatalogAccommodation } from './types'

const base: CatalogAccommodation = {
  id: 's1',
  name_ar: 'فندق الشعاب',
  name_en: 'Reef Hotel',
  type: 'hotel',
  image: 'https://example.com/cover.jpg',
  images: ['https://example.com/cover.jpg', 'https://example.com/room.jpg'],
  rating: 4,
  location_ar: 'دهب',
  location_en: 'Dahab',
  from_price_per_person_per_night: 850,
  meal_plans: [],
  room_upgrades: [],
  description_ar: 'إقامة هادئة على البحر مباشرة.',
  description_en: 'A quiet stay right on the sea.',
  amenities_ar: ['حمام سباحة', 'واي فاي مجاني'],
  amenities_en: ['Swimming Pool', 'Free WiFi'],
}

test('stayQuickViewData picks the localized name, description and amenities', () => {
  const en = stayQuickViewData(base, 'en')
  assert.equal(en.name, 'Reef Hotel')
  assert.equal(en.description, 'A quiet stay right on the sea.')
  assert.deepEqual(en.amenities, ['Swimming Pool', 'Free WiFi'])
  assert.equal(en.fromPricePerPersonPerNight, 850)

  const ar = stayQuickViewData(base, 'ar')
  assert.equal(ar.name, 'فندق الشعاب')
  assert.equal(ar.description, 'إقامة هادئة على البحر مباشرة.')
  assert.deepEqual(ar.amenities, ['حمام سباحة', 'واي فاي مجاني'])
})

test('stayQuickViewData falls back to the cover image when images is empty, and to no images at all', () => {
  const withOnlyCover: CatalogAccommodation = { ...base, images: [] }
  assert.deepEqual(stayQuickViewData(withOnlyCover, 'en').images, ['https://example.com/cover.jpg'])

  const withNothing: CatalogAccommodation = { ...base, image: '', images: [] }
  assert.deepEqual(stayQuickViewData(withNothing, 'en').images, [])
})

test('stayQuickViewData de-duplicates images and caps at maxImages', () => {
  const dup: CatalogAccommodation = { ...base, images: ['a.jpg', 'b.jpg', 'a.jpg', 'c.jpg'] }
  assert.deepEqual(stayQuickViewData(dup, 'en').images, ['a.jpg', 'b.jpg', 'c.jpg'])
  assert.deepEqual(stayQuickViewData(dup, 'en', { maxImages: 2 }).images, ['a.jpg', 'b.jpg'])
})

test('stayQuickViewData caps amenities at maxAmenities and handles missing fields gracefully', () => {
  const many: CatalogAccommodation = { ...base, amenities_en: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] }
  assert.equal(stayQuickViewData(many, 'en').amenities.length, 6)
  assert.equal(stayQuickViewData(many, 'en', { maxAmenities: 3 }).amenities.length, 3)

  const noExtras: CatalogAccommodation = { ...base, description_ar: undefined, description_en: undefined, amenities_ar: undefined, amenities_en: undefined }
  const mapped = stayQuickViewData(noExtras, 'en')
  assert.equal(mapped.description, '')
  assert.deepEqual(mapped.amenities, [])
})
