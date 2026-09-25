import assert from 'node:assert/strict'
import test from 'node:test'
import { requestJourney, type JourneyLookups } from './request-journey'

const TRIP = 'b1000000-0000-4000-8000-000000000001'
const PKG = 'c2000000-0000-4000-8000-000000000002'

const lookups: JourneyLookups = {
  origins: { cairo: { name_ar: 'القاهرة', name_en: 'Cairo' } },
  trips: { [TRIP]: { name_ar: 'البلو هول', name_en: 'Blue Hole' } },
  packages: { [PKG]: { name_ar: 'كانيون وسفاري', name_en: 'Canyon & Safari' } },
  mealPlans: [{ key: 'breakfast', label_ar: 'إفطار', label_en: 'Breakfast' }],
}

const record = {
  origin_governorate_code: 'cairo',
  meal_plan_key: 'breakfast',
  adults: 2,
  children: 0,
  quoted_total: '28100.00',
  experiences: [
    { kind: 'trip', id: TRIP, preferred_date: '2026-10-09' },
    { kind: 'trip_package', id: PKG },
  ],
  quote_snapshot: {
    total: 28100, nights: 4, accommodation_subtotal: 18800, meal_subtotal: 2000, transfer_subtotal: 1600,
    extra_trips_subtotal: 1800, trip_packages_subtotal: 3900,
    extra_trips: [{ trip_id: TRIP, price: 900 }],
    trip_packages: [{ package_id: PKG, total: 3900 }],
  },
  payment_plan: { upfrontAmount: 16350, balanceAmount: 11750 },
}

test('names come from lookups; prices from the frozen snapshot', () => {
  const journey = requestJourney(record, lookups)
  assert.deepEqual(journey.origin, { code: 'cairo', name_ar: 'القاهرة', name_en: 'Cairo' })
  assert.equal(journey.meal_plan?.name_en, 'Breakfast')
  assert.deepEqual(journey.experiences.map((e) => [e.kind, e.name_en, e.total, e.preferred_date]), [
    ['trip', 'Blue Hole', 1800, '2026-10-09'],
    ['trip_package', 'Canyon & Safari', 3900, null],
  ])
  assert.deepEqual(journey.quote_lines.map((line) => line.key), ['accommodation', 'meals', 'transfer', 'trips', 'packages'])
  assert.equal(journey.quote_total, 28100)
  assert.deepEqual(journey.payment, { after_confirmation: 16350, on_arrival: 11750 })
})

test('missing catalogue names fall back to the stored id instead of inventing one', () => {
  const journey = requestJourney(record, { ...lookups, trips: {}, origins: {} })
  assert.equal(journey.experiences[0].name_en, TRIP)
  assert.equal(journey.origin?.name_en, 'cairo')
})

test('a stay-only request without snapshot money renders empty, not zero lines', () => {
  const journey = requestJourney({ adults: 1, experiences: [], quote_snapshot: { total: 3000 } }, lookups)
  assert.equal(journey.origin, null)
  assert.deepEqual(journey.quote_lines, [])
  assert.equal(journey.quote_total, 3000)
  assert.equal(journey.payment, null)
})

test('malformed experiences are skipped', () => {
  const journey = requestJourney({ experiences: [{ kind: 'hotel', id: 'x' }, null, { kind: 'trip' }] }, lookups)
  assert.deepEqual(journey.experiences, [])
})
