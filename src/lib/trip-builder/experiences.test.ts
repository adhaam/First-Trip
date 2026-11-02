import assert from 'node:assert/strict'
import test from 'node:test'
import { conflictingSelectedPackages, filterTripsByCategory, packageIncludedSummary, planPackageToggle, redundantStandaloneTrips, selectedPackageCovering, standaloneTripsCoveredBy, tripCategories } from './experiences'
import type { CatalogPackage, CatalogTrip } from './types'

const diving: CatalogTrip = { id: 'a', name_ar: 'غطس', name_en: 'Diving', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 500, category_slugs: ['diving'], category_labels: [{ ar: 'غطس', en: 'Diving' }] }
const hiking: CatalogTrip = { id: 'b', name_ar: 'سفاري', name_en: 'Hiking', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 700, category_slugs: ['hiking', 'diving'], category_labels: [{ ar: 'رحلات', en: 'Hiking' }, { ar: 'غطس', en: 'Diving' }] }
const uncategorized: CatalogTrip = { id: 'c', name_ar: 'مفاجأة', name_en: 'Surprise', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 300, category_slugs: [], category_labels: [] }
const blueHole: CatalogTrip = { id: 'd', name_ar: 'الحفرة الزرقاء', name_en: 'Blue Hole', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 400, category_slugs: [], category_labels: [] }
const yacht: CatalogTrip = { id: 'e', name_ar: 'يخت', name_en: 'Yacht', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 900, category_slugs: [], category_labels: [] }
const sunsetSafari: CatalogTrip = { id: 'f', name_ar: 'رحلة الغروب', name_en: 'Sunset Safari', image: '', duration_ar: 'يوم', duration_en: '1 day', price: 600, category_slugs: [], category_labels: [] }
const allTrips = [diving, hiking, uncategorized, blueHole, yacht, sunsetSafari]

function makePackage(trip_ids: string[]): Pick<CatalogPackage, 'trip_ids'> {
  return { trip_ids }
}

test('tripCategories collects unique categories in first-seen order', () => {
  assert.deepEqual(tripCategories([diving, hiking, uncategorized]), [
    { slug: 'diving', name_ar: 'غطس', name_en: 'Diving' },
    { slug: 'hiking', name_ar: 'رحلات', name_en: 'Hiking' },
  ])
})

test('filterTripsByCategory shows everything for null and only matches for a slug', () => {
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], null), [diving, hiking, uncategorized])
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], 'diving'), [diving, hiking])
  assert.deepEqual(filterTripsByCategory([diving, hiking, uncategorized], 'hiking'), [hiking])
})

test('packageIncludedSummary keeps trip_ids order and localizes names', () => {
  const pkg = makePackage(['d', 'e', 'f'])
  assert.deepEqual(packageIncludedSummary(pkg, allTrips, 'en', 3), { names: ['Blue Hole', 'Yacht', 'Sunset Safari'], extra: 0 })
  assert.deepEqual(packageIncludedSummary(pkg, allTrips, 'ar', 3), { names: ['الحفرة الزرقاء', 'يخت', 'رحلة الغروب'], extra: 0 })
})

test('packageIncludedSummary caps at max and reports the remainder as extra', () => {
  const pkg = makePackage(['d', 'e', 'f', 'a', 'b'])
  assert.deepEqual(packageIncludedSummary(pkg, allTrips, 'en'), { names: ['Blue Hole', 'Yacht', 'Sunset Safari'], extra: 2 })
  assert.deepEqual(packageIncludedSummary(pkg, allTrips, 'en', 2), { names: ['Blue Hole', 'Yacht'], extra: 3 })
})

test('packageIncludedSummary skips trip ids that no longer resolve to a catalog trip', () => {
  const pkg = makePackage(['d', 'missing-id', 'e'])
  assert.deepEqual(packageIncludedSummary(pkg, allTrips, 'en'), { names: ['Blue Hole', 'Yacht'], extra: 0 })
})

test('packageIncludedSummary returns empty names for an empty package', () => {
  assert.deepEqual(packageIncludedSummary(makePackage([]), allTrips, 'en'), { names: [], extra: 0 })
})

// ─── Duplicate-charge prevention ───
const pkgA: CatalogPackage = { id: 'pa', slug: 'a', name_ar: 'أ', name_en: 'Pack A', image: '', payment_kind: 'experience_package', trip_count: 2, trip_ids: ['d', 'e'] }
const pkgB: CatalogPackage = { ...pkgA, id: 'pb', slug: 'b', name_en: 'Pack B', trip_ids: ['e', 'f'] }
const pkgC: CatalogPackage = { ...pkgA, id: 'pc', slug: 'c', name_en: 'Pack C', trip_ids: ['f'] }
const pkgs = [pkgA, pkgB, pkgC]
const sel = (kind: 'trip' | 'trip_package', id: string) => ({ kind, id })

test('selectedPackageCovering finds the selected package that already includes a trip', () => {
  assert.equal(selectedPackageCovering('d', pkgs, [sel('trip_package', 'pa')])?.id, 'pa')
  assert.equal(selectedPackageCovering('d', pkgs, [sel('trip_package', 'pc')]), undefined)
  assert.equal(selectedPackageCovering('d', pkgs, [sel('trip', 'd')]), undefined)
  assert.equal(selectedPackageCovering('d', pkgs, undefined), undefined)
})

test('standaloneTripsCoveredBy lists only selected standalone trips inside the package', () => {
  const experiences = [sel('trip', 'd'), sel('trip', 'a'), sel('trip', 'f')]
  assert.deepEqual(standaloneTripsCoveredBy(pkgA, allTrips, experiences).map((trip) => trip.id), ['d'])
  assert.deepEqual(standaloneTripsCoveredBy(pkgA, allTrips, []), [])
})

test('redundantStandaloneTrips repairs only trips covered by a SELECTED package', () => {
  const experiences = [sel('trip', 'd'), sel('trip', 'f'), sel('trip_package', 'pa')]
  assert.deepEqual(redundantStandaloneTrips(pkgs, allTrips, experiences).map((trip) => trip.id), ['d'])
  assert.deepEqual(redundantStandaloneTrips(pkgs, allTrips, [sel('trip', 'd')]), [])
})

test('conflictingSelectedPackages reports other selected packages sharing a trip', () => {
  const experiences = [sel('trip_package', 'pb'), sel('trip_package', 'pc')]
  assert.deepEqual(conflictingSelectedPackages(pkgA, pkgs, experiences).map((p) => p.id), ['pb'])
  assert.deepEqual(conflictingSelectedPackages(pkgB, pkgs, [sel('trip_package', 'pb')]), [])
})

test('planPackageToggle: remove when selected, otherwise add listing trips to drop and blocking packages', () => {
  assert.deepEqual(planPackageToggle(pkgA, pkgs, allTrips, [sel('trip_package', 'pa')]), { mode: 'remove' })
  const plan = planPackageToggle(pkgA, pkgs, allTrips, [sel('trip', 'e'), sel('trip', 'a'), sel('trip_package', 'pb')])
  assert.equal(plan.mode, 'add')
  if (plan.mode === 'add') {
    assert.deepEqual(plan.removedTrips.map((trip) => trip.id), ['e'])
    assert.deepEqual(plan.blockedBy.map((p) => p.id), ['pb'])
  }
})
