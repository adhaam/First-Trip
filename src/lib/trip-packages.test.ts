// ─── Trip Package pricing tests ───
// Run with:  npx tsx --test src/lib/trip-packages.test.ts

import test from 'node:test'
import assert from 'node:assert/strict'
import { computePackageTotals, validateAndPriceTripPackages } from './pricing'
import type { TripPackage } from './types'

test('package total = SUM(package_price), never falls back to price', () => {
  const totals = computePackageTotals([
    { price: 600, package_price: 400 },
    { price: 700, package_price: 450 },
  ])
  assert.equal(totals.publicTotal, 1300)
  assert.equal(totals.packageTotal, 850)
  assert.equal(totals.savings, 450)
  assert.equal(totals.isValid, true)
})

test('a trip missing package_price makes the whole package invalid — no silent fallback to price', () => {
  const totals = computePackageTotals([
    { price: 600, package_price: 400 },
    { price: 700, package_price: null },
  ])
  assert.equal(totals.isValid, false)
  // packageTotal only sums the valid trip(s) — the invalid flag is what gates
  // publish/booking, not a zeroed-out total.
  assert.equal(totals.packageTotal, 400)
})

test('a package with zero or negative package_price is invalid', () => {
  assert.equal(computePackageTotals([{ price: 100, package_price: 0 }]).isValid, false)
  assert.equal(computePackageTotals([{ price: 100, package_price: -5 }]).isValid, false)
})

test('an empty trip list is invalid (nothing to publish/book)', () => {
  assert.equal(computePackageTotals([]).isValid, false)
})

function makePkg(id: string, name: string, trips: { id: string; price: number; package_price: number }[]): TripPackage {
  const fullTrips = trips.map((t) => ({
    id: t.id, name_ar: t.id, name_en: t.id, price: t.price, package_price: t.package_price, sort_order: 0,
  }))
  return {
    id, slug: id, name_ar: name, name_en: name,
    short_description_ar: '', short_description_en: '', description_ar: '', description_en: '',
    image: '', featured: false, is_active: true, sort_order: 0, created_at: '',
    trips: fullTrips,
    totals: computePackageTotals(fullTrips),
  }
}

test('valid, non-overlapping packages price correctly with no extra trips', () => {
  const pkgA = makePkg('a', 'Package A', [{ id: 't1', price: 600, package_price: 400 }, { id: 't2', price: 700, package_price: 450 }])
  const result = validateAndPriceTripPackages([pkgA], [])
  assert.equal(result.error, null)
  assert.equal(result.subtotal, 850)
})

test('rejects a package containing a trip that is invalid/missing package_price', () => {
  const pkgA = makePkg('a', 'Package A', [{ id: 't1', price: 600, package_price: 0 }])
  const result = validateAndPriceTripPackages([pkgA], [])
  assert.ok(result.error)
  assert.equal(result.subtotal, 0)
})

test('rejects two selected packages that share a trip (package vs package overlap) — never double-charges', () => {
  const pkgA = makePkg('a', 'Package A', [{ id: 't1', price: 600, package_price: 400 }])
  const pkgB = makePkg('b', 'Package B', [{ id: 't1', price: 600, package_price: 400 }, { id: 't2', price: 500, package_price: 300 }])
  const result = validateAndPriceTripPackages([pkgA, pkgB], [])
  assert.ok(result.error)
  assert.equal(result.subtotal, 0)
})

test('rejects an individually-selected extra trip that is already inside a selected package', () => {
  const pkgA = makePkg('a', 'Package A', [{ id: 't1', price: 600, package_price: 400 }])
  const result = validateAndPriceTripPackages([pkgA], ['t1'])
  assert.ok(result.error)
  assert.equal(result.subtotal, 0)
})

test('multiple valid, non-overlapping packages sum correctly', () => {
  const pkgA = makePkg('a', 'Package A', [{ id: 't1', price: 600, package_price: 400 }])
  const pkgB = makePkg('b', 'Package B', [{ id: 't2', price: 500, package_price: 300 }])
  const result = validateAndPriceTripPackages([pkgA, pkgB], ['t3'])
  assert.equal(result.error, null)
  assert.equal(result.subtotal, 700)
})
