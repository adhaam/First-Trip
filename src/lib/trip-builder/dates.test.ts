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
