import assert from 'node:assert/strict'
import test from 'node:test'
import { compactList, compactText, packageQuickViewData } from './package-quick-view'
import type { CatalogPackage, CatalogTrip } from './types'

const blueHole: CatalogTrip = {
  id: 't1', name_ar: 'الحفرة الزرقاء', name_en: 'Blue Hole', image: 'https://example.com/blue.jpg', duration_ar: 'يوم كامل', duration_en: 'Full day', price: 400,
  category_slugs: [], category_labels: [],
  description_ar: 'غطس وسنوركل.', description_en: 'Diving and snorkelling.',
  includes_ar: ['مواصلات', 'غداء'], includes_en: ['Transport', 'Lunch'],
}
const safari: CatalogTrip = {
  id: 't2', name_ar: 'سفاري', name_en: 'Safari', image: '', duration_ar: '', duration_en: '', price: 600,
  category_slugs: [], category_labels: [],
}
const colored: CatalogTrip = { ...safari, id: 't3', name_ar: 'الوادي الملون', name_en: 'Coloured Canyon', image: 'https://example.com/canyon.jpg', price: 500 }
const trips = [blueHole, safari, colored]

const pkg: CatalogPackage = {
  id: 'p1', slug: 'dahab-two', name_ar: 'باقة دهب', name_en: 'Dahab Pack', image: 'https://example.com/pack.jpg', payment_kind: 'experience_package',
  public_total: 1000, package_total: 850, trip_count: 2, trip_ids: ['t1', 't2'],
  short_description_ar: 'يومين مميزين', short_description_en: 'Two great days',
  description_ar: 'وصف الباقة', description_en: 'Package description',
}

test('localises name, summary, description and trip fields', () => {
  const en = packageQuickViewData(pkg, trips, 'en')
  assert.equal(en.name, 'Dahab Pack')
  assert.equal(en.summary, 'Two great days')
  assert.equal(en.description, 'Package description')
  assert.deepEqual(en.trips.map((trip) => trip.name), ['Blue Hole', 'Safari'])
  assert.deepEqual(en.trips[0], { id: 't1', name: 'Blue Hole', description: 'Diving and snorkelling.', image: 'https://example.com/blue.jpg', duration: 'Full day', includes: ['Transport', 'Lunch'] })

  const ar = packageQuickViewData(pkg, trips, 'ar')
  assert.equal(ar.name, 'باقة دهب')
  assert.equal(ar.summary, 'يومين مميزين')
  assert.equal(ar.trips[0].duration, 'يوم كامل')
  assert.deepEqual(ar.trips[0].includes, ['مواصلات', 'غداء'])
})

test('lists ALL included trips in package order and skips ids missing from the catalog', () => {
  const many = { ...pkg, trip_ids: ['t3', 'ghost', 't1', 't2'] }
  assert.deepEqual(packageQuickViewData(many, trips, 'en').trips.map((trip) => trip.id), ['t3', 't1', 't2'])
})

test('omits fields the catalogue does not have', () => {
  const data = packageQuickViewData(pkg, trips, 'en')
  const bare = data.trips[1]
  assert.equal('description' in bare, false)
  assert.equal('image' in bare, false)
  assert.equal('duration' in bare, false)
  assert.deepEqual(bare.includes, [])

  const noText = packageQuickViewData({ ...pkg, short_description_en: undefined, description_en: '   ' }, trips, 'en')
  assert.equal('summary' in noText, false)
  assert.equal('description' in noText, false)

  const noPrice = packageQuickViewData({ ...pkg, public_total: undefined, package_total: undefined }, trips, 'en')
  assert.equal('packageTotal' in noPrice, false)
  assert.equal('savings' in noPrice, false)
  assert.equal('groupTotal' in noPrice, false)
})

test('description identical to the summary is not shown twice', () => {
  const data = packageQuickViewData({ ...pkg, description_en: 'Two great days' }, trips, 'en')
  assert.equal(data.summary, 'Two great days')
  assert.equal('description' in data, false)
})

test('hero image prefers the package cover, then the first included trip photo, else none', () => {
  assert.equal(packageQuickViewData(pkg, trips, 'en').heroImage, 'https://example.com/pack.jpg')
  assert.equal(packageQuickViewData({ ...pkg, image: '' }, trips, 'en').heroImage, 'https://example.com/blue.jpg')
  assert.equal('heroImage' in packageQuickViewData({ ...pkg, image: '', trip_ids: ['t2'] }, trips, 'en'), false)
})

test('savings only appear when the stored public total exceeds the package total', () => {
  assert.equal(packageQuickViewData(pkg, trips, 'en').savings, 150)
  assert.equal('savings' in packageQuickViewData({ ...pkg, public_total: 850 }, trips, 'en'), false)
  assert.equal('savings' in packageQuickViewData({ ...pkg, public_total: 700 }, trips, 'en'), false)
  // No comparison at all (only one of the two stored totals) → no savings, no "regular price".
  const onlyPackage = packageQuickViewData({ ...pkg, public_total: undefined }, trips, 'en')
  assert.equal('savings' in onlyPackage, false)
  assert.equal('publicTotal' in onlyPackage, false)
  assert.equal(onlyPackage.packageTotal, 850)
})

test('group total is per-person package total × confirmed travellers', () => {
  const data = packageQuickViewData(pkg, trips, 'en', { travellers: 3 })
  assert.equal(data.travellers, 3)
  assert.equal(data.groupTotal, 2550)
  const unconfirmed = packageQuickViewData(pkg, trips, 'en')
  assert.equal('travellers' in unconfirmed, false)
  assert.equal('groupTotal' in unconfirmed, false)
})

test('detects selected standalone trips already included in the package', () => {
  const experiences = [{ kind: 'trip' as const, id: 't1' }, { kind: 'trip' as const, id: 't3' }]
  const data = packageQuickViewData(pkg, trips, 'ar', { experiences, packages: [pkg] })
  assert.deepEqual(data.coveredStandaloneTrips, [{ id: 't1', name: 'الحفرة الزرقاء' }])
  assert.deepEqual(packageQuickViewData(pkg, trips, 'en', { experiences: [] }).coveredStandaloneTrips, [])
})

test('flags other selected packages that share a trip', () => {
  const other: CatalogPackage = { ...pkg, id: 'p2', name_en: 'Other', name_ar: 'أخرى', trip_ids: ['t2', 't3'] }
  const disjoint: CatalogPackage = { ...pkg, id: 'p3', name_en: 'Disjoint', trip_ids: ['t3'] }
  const experiences = [{ kind: 'trip_package' as const, id: 'p2' }, { kind: 'trip_package' as const, id: 'p3' }]
  const data = packageQuickViewData(pkg, trips, 'en', { experiences, packages: [pkg, other, disjoint] })
  assert.deepEqual(data.conflictingPackages, [{ id: 'p2', name: 'Other' }])
})

test('compactText trims, cuts at a word boundary and drops blanks', () => {
  assert.equal(compactText('   ', 10), undefined)
  assert.equal(compactText(null, 10), undefined)
  assert.equal(compactText('  short  ', 10), 'short')
  assert.equal(compactText('one two three four five', 15), 'one two three…')
})

test('compactList drops blanks and caps count and length', () => {
  assert.equal(compactList([' ', ''], 3, 10), undefined)
  assert.equal(compactList(undefined, 3, 10), undefined)
  assert.deepEqual(compactList(['a', ' ', 'b', 'c', 'd'], 3, 10), ['a', 'b', 'c'])
})

test('no "You save" or "booked separately" figure while an included trip is discounted (stored comparison no longer true)', () => {
  // Blue Hole is on offer today: 400 → 300, so separately the trips cost 900, not the stored 1,000.
  const discounted = [{ ...blueHole, price: 300 }, safari, colored]
  const view = packageQuickViewData(pkg, discounted, 'en')
  assert.equal('savings' in view, false)
  assert.equal('publicTotal' in view, false)
  assert.equal(view.packageTotal, 850)
})
