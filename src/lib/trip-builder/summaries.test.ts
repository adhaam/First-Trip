import assert from 'node:assert/strict'
import test from 'node:test'
import { formatDate } from '@/lib/format'
import type { TransportScheduleConfig } from '@/lib/transport'
import {
  datesSummary,
  experiencesSummary,
  recommendedCheckInWeekdayNames,
  roomsSummary,
  staySummary,
  transportOutboundWeekdayNames,
  transportSummary,
  travelersSummary,
} from './summaries'
import type { BuilderCatalog, BuilderState } from './types'

const schedule: TransportScheduleConfig = {
  services: [{ transferType: 'package_bus', isActive: true, scheduleMode: 'scheduled' }],
  weeklyRules: [
    { transferType: 'package_bus', direction: 'outbound', weekday: 4, isActive: true },
    { transferType: 'package_bus', direction: 'return', weekday: 0, isActive: true },
  ],
  exceptions: [],
  stayPatterns: [{ code: 'three_night', transferType: 'package_bus', nameAr: 'ثلاث ليالٍ', nameEn: 'Three nights', durationDays: 4, nights: 3, returnOffsetDays: 3, isActive: true, sortOrder: 0 }],
  recommendedCheckInWeekdays: [1, 5],
}

const catalog: BuilderCatalog = {
  schedule,
  today: '2026-09-24',
  governorates: [{ code: 'cairo', name_ar: 'القاهرة', name_en: 'Cairo', transfer_types: ['package_bus'] }],
  transferServices: [{ type: 'package_bus', name_ar: 'باص WEEMAP', name_en: 'WEEMAP Bus', vehicle_ar: 'باص', vehicle_en: 'Bus', is_active: true }],
  accommodations: [{
    id: 'stay-1', name_ar: 'كامب دهب', name_en: 'Dahab Camp', type: 'camp', image: '', images: [],
    rating: 4, location_ar: 'دهب', location_en: 'Dahab', from_price_per_person_per_night: 500,
    meal_plans: [{ key: 'breakfast', label_ar: 'فطار', label_en: 'Breakfast', price_per_person_per_night: 100, is_active: true }],
    room_upgrades: [],
  }],
  trips: [],
  packages: [],
  paymentPolicies: [],
}

const base: BuilderState = { locale: 'en', source: 'website', adults: 1, children: 0, experiences: [], contact: {} }

test('transportSummary is null until mode (and origin, when required) are chosen', () => {
  assert.equal(transportSummary(base, catalog, 'en'), null)
  assert.equal(transportSummary({ ...base, transport_mode: 'package_bus' }, catalog, 'en'), null)
  assert.deepEqual(transportSummary({ ...base, transport_mode: 'package_bus', origin_governorate_code: 'cairo' }, catalog, 'en'), {
    key: 'summaryTransportPackageBus',
    values: { origin: 'Cairo' },
  })
  assert.deepEqual(transportSummary({ ...base, transport_mode: 'hiace', origin_governorate_code: 'cairo' }, catalog, 'en'), {
    key: 'summaryTransportHiace',
    values: { origin: 'Cairo' },
  })
  assert.deepEqual(transportSummary({ ...base, transport_mode: 'stay_only' }, catalog, 'en'), { key: 'summaryStayOnly' })
})

test('datesSummary resolves the return date for a transport pattern', () => {
  assert.equal(datesSummary({ ...base, transport_mode: 'package_bus' }, catalog, 'en'), null)
  const summary = datesSummary(
    { ...base, transport_mode: 'package_bus', origin_governorate_code: 'cairo', stay_pattern_code: 'three_night', arrival_date: '2026-10-01' },
    catalog,
    'en',
  )
  assert.deepEqual(summary, {
    key: 'summaryTransportDates',
    values: { pattern: 'Three nights', arrival: formatDate('2026-10-01', 'en'), return: formatDate('2026-10-04', 'en') },
  })
})

test('datesSummary handles stay-only check-in/check-out', () => {
  assert.deepEqual(
    datesSummary({ ...base, transport_mode: 'stay_only', arrival_date: '2026-10-01', departure_date: '2026-10-04' }, catalog, 'en'),
    { key: 'summaryStayDates', values: { arrival: formatDate('2026-10-01', 'en'), departure: formatDate('2026-10-04', 'en'), nights: 3 } },
  )
})

test('travelersSummary distinguishes adults-only from adults+children', () => {
  assert.deepEqual(travelersSummary(base), { key: 'summaryTravelers', values: { adults: 1, children: 0 } })
  assert.deepEqual(travelersSummary({ ...base, adults: 2, children: 1 }), { key: 'summaryTravelersWithChildren', values: { adults: 2, children: 1 } })
})

test('staySummary distinguishes an unset stay from an explicit transfer-only choice', () => {
  assert.equal(staySummary(base, catalog, 'en'), null)
  assert.deepEqual(staySummary({ ...base, transport_mode: 'package_bus' }, catalog, 'en'), { key: 'summaryTransferOnly' })
  assert.deepEqual(staySummary({ ...base, accommodation_id: 'stay-1' }, catalog, 'en'), { key: 'summaryStay', values: { stay: 'Dahab Camp' } })
})

test('roomsSummary includes the meal plan once one is chosen', () => {
  assert.equal(roomsSummary({ ...base, accommodation_id: 'stay-1' }, catalog, 'en'), null)
  const allocations = [{ type: 'double' as const, count: 1 }]
  assert.deepEqual(roomsSummary({ ...base, accommodation_id: 'stay-1', room_allocations: allocations }, catalog, 'en'), {
    key: 'summaryRooms',
    values: { rooms: 1, capacity: 2 },
  })
  assert.deepEqual(
    roomsSummary({ ...base, accommodation_id: 'stay-1', room_allocations: allocations, meal_plan_key: 'breakfast' }, catalog, 'en'),
    { key: 'summaryRoomsMeal', values: { rooms: 1, capacity: 2, meal: 'Breakfast' } },
  )
})

test('experiencesSummary only appears once something has been added', () => {
  assert.equal(experiencesSummary(base), null)
  assert.deepEqual(experiencesSummary({ ...base, experiences: [{ kind: 'trip', id: 'a' }] }), { key: 'summaryExperiences', values: { count: 1 } })
})

test('recommendedCheckInWeekdayNames formats configured weekdays, never hard-coded ones', () => {
  assert.equal(recommendedCheckInWeekdayNames(schedule, 'en'), 'Monday & Friday')
  assert.equal(recommendedCheckInWeekdayNames({ ...schedule, recommendedCheckInWeekdays: [] }, 'en'), '')
})

test('transportOutboundWeekdayNames reads the weekly rules for a scheduled mode and is empty for on-demand/stay-only', () => {
  assert.equal(transportOutboundWeekdayNames(schedule, 'package_bus', 'en'), 'Thursday')
  assert.equal(transportOutboundWeekdayNames(schedule, 'hiace', 'en'), '')
  assert.equal(transportOutboundWeekdayNames(schedule, 'stay_only', 'en'), '')
  assert.equal(transportOutboundWeekdayNames(schedule, undefined, 'en'), '')
})
