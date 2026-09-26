import assert from 'node:assert/strict'
import test from 'node:test'
import { addDays, weekdayForDate } from '@/lib/transport'
import type { BuilderCatalog } from './types'
import { applyPrefill, builderReducer, initialBuilderState } from './state'

const ids = {
  stay: '00000000-0000-4000-8000-000000000001',
  otherStay: '00000000-0000-4000-8000-000000000002',
  trip: '00000000-0000-4000-8000-000000000003',
  package: '00000000-0000-4000-8000-000000000004',
}
const outbound = '2026-10-06'
const fixture: BuilderCatalog = {
  today: '2026-10-01',
  schedule: {
    services: [{ transferType: 'package_bus', isActive: true, scheduleMode: 'scheduled' }, { transferType: 'hiace', isActive: true, scheduleMode: 'on_demand' }],
    weeklyRules: [{ transferType: 'package_bus', direction: 'outbound', weekday: weekdayForDate(outbound), isActive: true }, { transferType: 'package_bus', direction: 'return', weekday: weekdayForDate(addDays(outbound, 3)), isActive: true }],
    exceptions: [],
    stayPatterns: [{ code: 'three', transferType: 'package_bus', nameAr: '', nameEn: '', durationDays: 4, nights: 3, returnOffsetDays: 3, departureWeekdays: [weekdayForDate(outbound)], isActive: true, sortOrder: 0 }, { code: 'hiace', transferType: 'hiace', nameAr: '', nameEn: '', durationDays: 2, nights: 1, returnOffsetDays: 1, isActive: true, sortOrder: 0 }],
    recommendedCheckInWeekdays: [],
  },
  governorates: [{ code: 'cairo', name_ar: '', name_en: '', transfer_types: ['package_bus'] }, { code: 'giza', name_ar: '', name_en: '', transfer_types: ['hiace'] }],
  transferServices: [],
  accommodations: [
    { id: ids.stay, name_ar: '', name_en: '', type: '', image: '', images: [], rating: 0, location_ar: '', location_en: '', from_price_per_person_per_night: 0, meal_plans: [{ key: 'breakfast', label_ar: '', label_en: '', price_per_person_per_night: 0, is_active: true }], room_upgrades: [{ id: ids.package, name_ar: '', name_en: '', extra_price_per_night: 0 }] },
    { id: ids.otherStay, name_ar: '', name_en: '', type: '', image: '', images: [], rating: 0, location_ar: '', location_en: '', from_price_per_person_per_night: 0, meal_plans: [], room_upgrades: [] },
  ],
  trips: [{ id: ids.trip, name_ar: '', name_en: '', image: '', duration_ar: '', duration_en: '', price: 0, category_slugs: [], category_labels: [] }],
  packages: [{ id: ids.package, slug: '', name_ar: '', name_en: '', image: '', payment_kind: 'experience_package', trip_count: 1, trip_ids: [ids.trip] }],
  paymentPolicies: [],
}

test('prefill merges valid experiences, dedupes, and rejects invalid mode/origin ids', () => {
  const state = { ...initialBuilderState(), experiences: [{ kind: 'trip' as const, id: ids.trip }] }
  const next = applyPrefill(state, { mode: 'hiace', from: 'cairo', trip: [ids.trip, 'bad'], package: [ids.package, ids.package], stay: 'bad' }, fixture)
  assert.equal(next.transport_mode, 'hiace')
  assert.equal(next.origin_governorate_code, undefined)
  assert.equal(next.accommodation_id, undefined)
  assert.deepEqual(next.experiences, [{ kind: 'trip', id: ids.trip }, { kind: 'trip_package', id: ids.package }])
})

test('mode, pattern, and origin changes clear dates that the supplied schedule invalidates', () => {
  const transport = { ...initialBuilderState(), transport_mode: 'package_bus' as const, origin_governorate_code: 'cairo', stay_pattern_code: 'three', arrival_date: outbound, departure_date: '2026-10-09' }
  const stayOnly = builderReducer(transport, { type: 'setMode', mode: 'stay_only', catalog: fixture })
  assert.equal(stayOnly.arrival_date, outbound)
  assert.equal(stayOnly.origin_governorate_code, undefined)
  const backToTransport = builderReducer(stayOnly, { type: 'setMode', mode: 'package_bus', catalog: fixture })
  assert.equal(backToTransport.departure_date, undefined)
  assert.equal(backToTransport.arrival_date, undefined)
  // Only an origin-specific outbound rule can make an origin change invalidate a date.
  const cairoOnly: BuilderCatalog = {
    ...fixture,
    schedule: {
      ...fixture.schedule,
      weeklyRules: fixture.schedule.weeklyRules.map((rule) => rule.direction === 'outbound' ? { ...rule, originGovernorateCode: 'cairo' } : rule),
    },
  }
  const keptByOrigin = builderReducer(transport, { type: 'setOrigin', origin: 'giza', catalog: fixture })
  assert.equal(keptByOrigin.arrival_date, outbound)
  const invalidByOrigin = builderReducer(transport, { type: 'setOrigin', origin: 'giza', catalog: cairoOnly })
  assert.equal(invalidByOrigin.arrival_date, undefined)
  const invalidByPattern = builderReducer(transport, { type: 'setPattern', pattern: 'hiace', catalog: fixture })
  assert.equal(invalidByPattern.arrival_date, undefined)
})

test('stay and traveler changes only replace automatic room allocations', () => {
  const withStay = builderReducer({ ...initialBuilderState(), adults: 2, children: 1, meal_plan_key: 'breakfast', upgrade_id: ids.package }, { type: 'setStay', id: ids.otherStay, catalog: fixture })
  assert.deepEqual(withStay.room_allocations, [{ type: 'double', count: 2 }])
  assert.equal(withStay.meal_plan_key, undefined)
  assert.equal(withStay.upgrade_id, undefined)
  const automatic = builderReducer(withStay, { type: 'setTravelers', adults: 5, children: 0 })
  assert.deepEqual(automatic.room_allocations, [{ type: 'double', count: 3 }])
  const custom = builderReducer({ ...withStay, room_allocations: [{ type: 'single', count: 3 }] }, { type: 'setTravelers', adults: 5, children: 0 })
  assert.deepEqual(custom.room_allocations, [{ type: 'single', count: 3 }])
  const noStay = builderReducer(initialBuilderState(), { type: 'setTravelers', adults: 4, children: 0 })
  assert.equal(noStay.room_allocations, undefined)
})

test('experience selection is capped at ten', () => {
  let state = initialBuilderState()
  for (let index = 0; index < 11; index += 1) state = builderReducer(state, { type: 'toggleExperience', kind: 'trip', id: `id-${index}` })
  assert.equal(state.experiences?.length, 10)
})

test('automatic experience removal is idempotent and never re-adds a covered trip', () => {
  const selected = { ...initialBuilderState(), experiences: [{ kind: 'trip' as const, id: ids.trip }] }
  const once = builderReducer(selected, { type: 'removeExperience', kind: 'trip', id: ids.trip })
  const twice = builderReducer(once, { type: 'removeExperience', kind: 'trip', id: ids.trip })
  assert.deepEqual(once.experiences, [])
  assert.deepEqual(twice.experiences, [])
})
