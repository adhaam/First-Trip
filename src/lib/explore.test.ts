import assert from 'node:assert/strict'
import test from 'node:test'
import { categoryFromSearchParam, packagesIncludingTrip, tripsForCategory } from './explore'
import type { SinaiTrip, TripCategory, TripPackage } from './types'

const category = (id: string, slug = id): TripCategory => ({
  id,
  slug,
  name_ar: '',
  name_en: id,
  is_active: true,
  sort_order: 0,
})

const trip = (id: string, primary?: TripCategory, tags: TripCategory[] = []): SinaiTrip => ({
  id,
  trip_category_id: primary?.id ?? null,
  category: primary ? { ...primary, source: 'structured' } : null,
  category_tags: tags,
  category_ar: '',
  category_en: '',
  name_ar: '',
  name_en: '',
  description_ar: '',
  description_en: '',
  images: [],
  duration: '',
  duration_en: '',
  price: 0,
  includes_ar: [],
  includes_en: [],
  sort_order: 0,
  is_active: true,
  created_at: '',
})

const pkg = (id: string, payment_kind?: TripPackage['payment_kind'], trips?: TripPackage['trips']): TripPackage => ({
  id,
  slug: id,
  name_ar: '',
  name_en: '',
  short_description_ar: '',
  short_description_en: '',
  description_ar: '',
  description_en: '',
  image: '',
  payment_kind,
  featured: false,
  is_active: true,
  sort_order: 0,
  created_at: '',
  trips,
})

test('categoryFromSearchParam keeps only category ids represented by server trips', () => {
  const hike = category('hike-id')
  assert.equal(categoryFromSearchParam('hike-id', [trip('1', hike)]), 'hike-id')
  assert.equal(categoryFromSearchParam('unknown', [trip('1', hike)]), 'all')
  assert.equal(categoryFromSearchParam(undefined, [trip('1', hike)]), 'all')
  assert.equal(categoryFromSearchParam(['hike-id'], [trip('1', hike)]), 'all') // array value never a valid single category
})

test('categoryFromSearchParam also resolves a category slug to its canonical id', () => {
  const hike = category('hike-id', 'hiking-day-trips')
  assert.equal(categoryFromSearchParam('hiking-day-trips', [trip('1', hike)]), 'hike-id')
})

test('categoryFromSearchParam matches a category carried only as a tag, not the primary', () => {
  const primary = category('dive-id')
  const tag = category('sunset-id', 'sunset')
  assert.equal(categoryFromSearchParam('sunset-id', [trip('1', primary, [tag])]), 'sunset-id')
  assert.equal(categoryFromSearchParam('sunset', [trip('1', primary, [tag])]), 'sunset-id')
})

test('tripsForCategory returns every trip for "all" and filters otherwise', () => {
  const hike = category('hike-id')
  const dive = category('dive-id')
  const trips = [trip('1', hike), trip('2', dive)]
  assert.deepEqual(tripsForCategory(trips, 'all').map((t) => t.id), ['1', '2'])
  assert.deepEqual(tripsForCategory(trips, 'dive-id').map((t) => t.id), ['2'])
})

test('packagesIncludingTrip finds only packages whose joined trips contain the given trip id', () => {
  const withTrip: TripPackage['trips'] = [{ id: 't1', name_ar: '', name_en: '', price: 0, package_price: null, sort_order: 0 }]
  const packages = [pkg('has-it', 'experience_package', withTrip), pkg('does-not', 'experience_package', [])]
  assert.deepEqual(packagesIncludingTrip(packages, 't1').map((p) => p.id), ['has-it'])
  assert.deepEqual(packagesIncludingTrip(packages, 'missing'), [])
})

test('packagesIncludingTrip tolerates packages fetched without joined trips', () => {
  assert.deepEqual(packagesIncludingTrip([pkg('no-trips')], 't1'), [])
})
