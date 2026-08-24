// ─── WEEMAP SINAI — Room Upgrades & related regression tests ───
// Run with:  npx tsx --test src/lib/room-upgrades.test.ts
// Requires Node 20+ (uses node:test built-in).
//
// Covers:
//  A. Room upgrade supplement math (upgradeSubtotal)
//  B. Upgrade data filtering (wrong hotel / inactive / fake)
//  C. Accommodation subtotal combined with upgrade supplement
//  D. Book Dahab price sort (startingRate logic)
//  E. Price summary position (structural: summary must appear after </form> in BookingForm.tsx)

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  upgradeSubtotal,
  accommodationSubtotal,
  resolveNightlyRates,
} from './pricing'
import type { RoomUpgrade } from './types'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Shared fixtures ───────────────────────────────────────────────────────

const BASE_ACC = {
  price_single_room: 1500,
  price_double_room: 2400,
  price_triple_room: 3300,
  seasonal_rates: [
    {
      id: 's1', accommodation_id: 'hotel-A',
      name: 'High Season',
      start_date: '2026-12-20', end_date: '2027-01-05',
      single_price: 2200, double_price: 3200, triple_price: 4400,
      is_active: true,
    },
  ],
}

// ─── A. Upgrade supplement math ────────────────────────────────────────────

test('A1. No upgrade: upgradeSubtotal(0, rooms, nights) === 0', () => {
  assert.equal(upgradeSubtotal(0, 1, 3), 0)
  assert.equal(upgradeSubtotal(0, 2, 4), 0)
})

test('A2. +500 upgrade: 1 room × 3 nights = 1500 extra', () => {
  assert.equal(upgradeSubtotal(500, 1, 3), 1500)
})

test('A3. +1000 upgrade: 1 room × 3 nights = 3000 extra', () => {
  assert.equal(upgradeSubtotal(1000, 1, 3), 3000)
})

test('A4. +500 upgrade × 2 rooms × 3 nights = 3000 extra', () => {
  assert.equal(upgradeSubtotal(500, 2, 3), 3000)
})

test('A5. upgradeSubtotal with NaN/undefined/null extra returns 0', () => {
  assert.equal(upgradeSubtotal(NaN, 1, 3), 0)
  assert.equal(upgradeSubtotal(undefined as unknown as number, 1, 3), 0)
  assert.equal(upgradeSubtotal(null as unknown as number, 1, 3), 0)
})

// ─── B. Upgrade data filtering ─────────────────────────────────────────────

/**
 * Pure helper that mirrors the server-side validation rule:
 * only upgrades belonging to the correct accommodation AND is_active=true are valid.
 * An injected (fake) upgrade from another hotel must be rejected.
 */
function filterValidUpgrades(
  upgrades: RoomUpgrade[],
  accommodationId: string,
): RoomUpgrade[] {
  return upgrades.filter((u) => u.accommodation_id === accommodationId && u.is_active)
}

const SEA_VIEW: RoomUpgrade = {
  id: 'u1', accommodation_id: 'hotel-A', name_ar: 'سي فيو', name_en: 'Sea View',
  extra_price_per_night: 1000, sort_order: 0, is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}
const DELUXE: RoomUpgrade = {
  id: 'u2', accommodation_id: 'hotel-A', name_ar: 'ديلوكس', name_en: 'Deluxe',
  extra_price_per_night: 500, sort_order: 1, is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}
const INACTIVE: RoomUpgrade = {
  id: 'u3', accommodation_id: 'hotel-A', name_ar: 'متوقف', name_en: 'Inactive Upgrade',
  extra_price_per_night: 800, sort_order: 2, is_active: false,
  created_at: '2026-01-01T00:00:00Z',
}
const WRONG_HOTEL: RoomUpgrade = {
  id: 'u4', accommodation_id: 'hotel-B', name_ar: 'فندق تاني', name_en: 'Other Hotel',
  extra_price_per_night: 2000, sort_order: 0, is_active: true,
  created_at: '2026-01-01T00:00:00Z',
}

test('B1. No upgrades: filter returns empty array', () => {
  assert.deepEqual(filterValidUpgrades([], 'hotel-A'), [])
})

test('B2. Active upgrades for correct hotel pass through', () => {
  const result = filterValidUpgrades([SEA_VIEW, DELUXE], 'hotel-A')
  assert.equal(result.length, 2)
})

test('B3. Inactive upgrade is rejected', () => {
  const result = filterValidUpgrades([SEA_VIEW, INACTIVE], 'hotel-A')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'u1')
})

test('B4. Upgrade from wrong hotel is rejected (fake supplement attack)', () => {
  const result = filterValidUpgrades([SEA_VIEW, WRONG_HOTEL], 'hotel-A')
  assert.equal(result.length, 1)
  assert.equal(result[0].id, 'u1')
})

test('B5. Completely fabricated supplement (wrong hotel + inactive) returns empty', () => {
  const result = filterValidUpgrades([INACTIVE, WRONG_HOTEL], 'hotel-A')
  assert.equal(result.length, 0)
})

test('B6. Mixed list — only valid upgrades survive', () => {
  const all = [SEA_VIEW, DELUXE, INACTIVE, WRONG_HOTEL]
  const valid = filterValidUpgrades(all, 'hotel-A')
  assert.equal(valid.length, 2)
  assert.ok(valid.every((u) => u.accommodation_id === 'hotel-A' && u.is_active))
})

// ─── C. Accommodation subtotal + upgrade supplement combined ───────────────

test('C1. Single room, no upgrade: 1500 × 3 nights = 4500', () => {
  const nightly = resolveNightlyRates(BASE_ACC, 'single', '2026-10-01', 3)
  const base = accommodationSubtotal(nightly, 1)
  const upgrade = upgradeSubtotal(0, 1, 3)
  assert.equal(base, 4500)
  assert.equal(upgrade, 0)
  assert.equal(base + upgrade, 4500)
})

test('C2. Double room + Sea View +1000: 2400×3 + 1000×3 = 7200 + 3000 = 10200', () => {
  const nightly = resolveNightlyRates(BASE_ACC, 'double', '2026-10-01', 3)
  const base = accommodationSubtotal(nightly, 1)  // 2400×3 = 7200
  const upgrade = upgradeSubtotal(1000, 1, 3)      // 1000×3 = 3000
  assert.equal(base, 7200)
  assert.equal(upgrade, 3000)
  assert.equal(base + upgrade, 10200)
})

test('C3. Triple room + Deluxe +500: 3300×3 + 500×3 = 9900 + 1500 = 11400', () => {
  const nightly = resolveNightlyRates(BASE_ACC, 'triple', '2026-10-01', 3)
  const base = accommodationSubtotal(nightly, 1)  // 3300×3 = 9900
  const upgrade = upgradeSubtotal(500, 1, 3)       // 500×3 = 1500
  assert.equal(base, 9900)
  assert.equal(upgrade, 1500)
  assert.equal(base + upgrade, 11400)
})

test('C4. Mixed allocations: 1 double (no upgrade) + 1 single (+500) over 3 nights', () => {
  // 1 double, no upgrade: 2400×3 = 7200
  const nightlyDouble = resolveNightlyRates(BASE_ACC, 'double', '2026-10-01', 3)
  const doubleBase = accommodationSubtotal(nightlyDouble, 1)
  const doubleUpgrade = upgradeSubtotal(0, 1, 3)

  // 1 single, +500 upgrade: 1500×3 + 500×3 = 4500 + 1500 = 6000
  const nightlySingle = resolveNightlyRates(BASE_ACC, 'single', '2026-10-01', 3)
  const singleBase = accommodationSubtotal(nightlySingle, 1)
  const singleUpgrade = upgradeSubtotal(500, 1, 3)

  assert.equal(doubleBase + doubleUpgrade, 7200)
  assert.equal(singleBase + singleUpgrade, 6000)
  assert.equal(doubleBase + doubleUpgrade + singleBase + singleUpgrade, 13200)
})

test('C5. Seasonal base + fixed upgrade supplement: supplement is always additive', () => {
  // Night 1 = base 2400; nights 2-4 cross into high season (double=3200)
  // Base subtotal: 2400 + 3200 + 3200 = 8800
  // +1000 upgrade × 3 nights = 3000
  // Total = 11800
  const nightly = resolveNightlyRates(BASE_ACC, 'double', '2026-12-19', 3)
  const base = accommodationSubtotal(nightly, 1)
  const upgrade = upgradeSubtotal(1000, 1, 3)
  assert.deepEqual(nightly.map((n) => n.rate), [2400, 3200, 3200])
  assert.equal(base, 8800)
  assert.equal(upgrade, 3000)
  assert.equal(base + upgrade, 11800)
})

// ─── D. Book Dahab price sort ───────────────────────────────────────────────

type AnyAcc = {
  price_single_room: number
  price_double_room: number
  price_triple_room: number
}

/**
 * startingRate — mirrors BookDahabClient.tsx exactly.
 * Returns the lowest non-zero room price. Zero/missing rooms sort last (Infinity).
 */
function startingRate(a: AnyAcc): number {
  const rates = [a.price_single_room, a.price_double_room, a.price_triple_room]
    .filter((r): r is number => typeof r === 'number' && r > 0)
  return rates.length ? Math.min(...rates) : Infinity
}

const accByRate = (s: number, d: number, t: number): AnyAcc => ({
  price_single_room: s, price_double_room: d, price_triple_room: t,
})

test('D1. startingRate picks the lowest non-zero room price', () => {
  assert.equal(startingRate(accByRate(1500, 2400, 3300)), 1500)
  assert.equal(startingRate(accByRate(0, 2400, 3300)), 2400)
  assert.equal(startingRate(accByRate(0, 0, 3300)), 3300)
})

test('D2. All-zero prices → Infinity (sorts last)', () => {
  assert.equal(startingRate(accByRate(0, 0, 0)), Infinity)
})

test('D3. Price-ascending sort: cheapest first, missing-price last', () => {
  const hotels = [
    accByRate(3000, 4000, 5000),   // min=3000
    accByRate(0, 0, 0),             // Infinity → last
    accByRate(1000, 2000, 2800),   // min=1000 → first
    accByRate(0, 2400, 3300),      // min=2400 → second
  ]
  const sorted = [...hotels].sort((a, b) => startingRate(a) - startingRate(b))
  const minRates = sorted.map(startingRate)
  assert.deepEqual(minRates, [1000, 2400, 3000, Infinity])
})

test('D4. Price-descending sort: most-expensive first, missing-price last', () => {
  const hotels = [
    accByRate(3000, 4000, 5000),   // min=3000
    accByRate(0, 0, 0),             // Infinity → should still be last
    accByRate(1000, 2000, 2800),   // min=1000 → last (non-Infinity)
    accByRate(0, 2400, 3300),      // min=2400
  ]
  // DESC: Infinity sentinel for 0-priced hotels must always sort LAST
  const sorted = [...hotels].sort((a, b) => {
    const pa = startingRate(a), pb = startingRate(b)
    if (pa === Infinity) return 1  // zero-price always last
    if (pb === Infinity) return -1
    return pb - pa  // descending
  })
  const minRates = sorted.map(startingRate)
  assert.deepEqual(minRates, [3000, 2400, 1000, Infinity])
})

// ─── E. Price card + booking form live in the sticky right column ─────────
//
// Commit 31e714d moved this layout out of BookingForm.tsx and into
// ProductDetailClient.tsx ("restore desktop sidebar"), so these assertions
// follow the markup to where it actually lives now.

test('E1. Price card and booking form share the sticky right column', () => {
  const src = readFileSync(
    join(__dirname, '../components/ProductDetailClient.tsx'),
    'utf-8',
  )
  const stickyIdx = src.indexOf('md:sticky md:top-24')
  const formIdx = src.indexOf('<BookingForm')

  assert.ok(stickyIdx > -1, 'md:sticky md:top-24 not found — desktop sidebar missing')
  assert.ok(formIdx > -1, '<BookingForm not rendered by ProductDetailClient.tsx')
  assert.ok(
    formIdx > stickyIdx,
    `BookingForm (at index ${formIdx}) must render inside the sticky column (opened at index ${stickyIdx})`,
  )
})

test('E2. ProductDetailClient.tsx uses a two-column grid layout', () => {
  const src = readFileSync(
    join(__dirname, '../components/ProductDetailClient.tsx'),
    'utf-8',
  )
  assert.ok(
    src.includes('md:grid-cols-[1fr_340px]') && src.includes('lg:grid-cols-[1fr_380px]'),
    'Two-column grid layout not found in ProductDetailClient.tsx',
  )
})
