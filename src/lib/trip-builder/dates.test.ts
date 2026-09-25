import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TRANSPORT_SCHEDULE } from '@/lib/transport'
import { arrivalOptions, returnDateFor } from './dates'

test('arrival options follow supplied schedule data rather than fixed weekdays', () => {
  const schedule = structuredClone(DEFAULT_TRANSPORT_SCHEDULE)
  schedule.weeklyRules = [
    { transferType: 'package_bus', direction: 'outbound', weekday: 2, isActive: true },
    { transferType: 'package_bus', direction: 'return', weekday: 6, isActive: true },
  ]
  schedule.stayPatterns = [{ code: 'changed', transferType: 'package_bus', nameAr: '', nameEn: '', durationDays: 5, nights: 4, returnOffsetDays: 4, departureWeekdays: [2], isActive: true, sortOrder: 0 }]
  assert.deepEqual(arrivalOptions(schedule, { mode: 'package_bus', patternCode: 'changed', from: '2026-10-01', count: 1 }), ['2026-10-06'])
  assert.equal(returnDateFor(schedule, { mode: 'package_bus', patternCode: 'changed', arrivalDate: '2026-10-06' }), '2026-10-10')
})

test('journeyNights follows the stay pattern for transport, not the calendar gap', async () => {
  const { journeyNights } = await import('./dates')
  const { DEFAULT_TRANSPORT_SCHEDULE, addDays, weekdayForDate } = await import('@/lib/transport')
  const pattern = DEFAULT_TRANSPORT_SCHEDULE.stayPatterns.find((candidate) => candidate.transferType === 'package_bus')!
  // Find the first date this pattern can depart on, from the configured data.
  let outbound = '2026-10-01'
  while (pattern.departureWeekdays && !pattern.departureWeekdays.includes(weekdayForDate(outbound))) outbound = addDays(outbound, 1)
  const nights = journeyNights(DEFAULT_TRANSPORT_SCHEDULE, { mode: 'package_bus', patternCode: pattern.code, arrivalDate: outbound })
  assert.equal(nights, pattern.nights)
  assert.equal(journeyNights(DEFAULT_TRANSPORT_SCHEDULE, { mode: 'stay_only', arrivalDate: '2026-10-01', departureDate: '2026-10-04' }), 3)
  assert.equal(journeyNights(DEFAULT_TRANSPORT_SCHEDULE, { mode: 'package_bus' }), null)
})
