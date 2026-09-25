import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { DEFAULT_TRANSPORT_SCHEDULE } from './defaults'
import {
  checkServiceDate,
  isRecommendedCheckIn,
  resolveStayPattern,
  returnOptions,
  weekdayForDate,
} from './schedule'
import type { TransportScheduleConfig } from './schedule'

function config(): TransportScheduleConfig {
  return structuredClone(DEFAULT_TRANSPORT_SCHEDULE)
}

test('migration 029 seed and defaults agree on weekly rules and stay patterns', () => {
  const sql = readFileSync('supabase/migrations/029_transport_schedule.sql', 'utf8')
  const seededRules = [...sql.matchAll(/\('package_bus',\s*'(outbound|return)',\s*(\d+),/g)]
    .map((match) => ({ direction: match[1], weekday: Number(match[2]) }))
  assert.deepEqual(
    DEFAULT_TRANSPORT_SCHEDULE.weeklyRules.map(({ direction, weekday }) => ({ direction, weekday })),
    seededRules,
  )

  const seededPatterns = [...sql.matchAll(
    /\('([^']+)',\s*'([^']+)',\s*'[^']*',\s*'[^']*',\s*(\d+),\s*(\d+),\s*(\d+),\s*(ARRAY\[(\d+)\]::SMALLINT\[\]|NULL),\s*(\d+)\)/g,
  )].map((match) => ({
    code: match[1], transferType: match[2], durationDays: Number(match[3]), nights: Number(match[4]),
    returnOffsetDays: Number(match[5]), departureWeekdays: match[6] === 'NULL' ? null : [Number(match[7])], sortOrder: Number(match[8]),
  }))
  assert.deepEqual(
    DEFAULT_TRANSPORT_SCHEDULE.stayPatterns.map(({ code, transferType, durationDays, nights, returnOffsetDays, departureWeekdays, sortOrder }) => ({
      code, transferType, durationDays, nights, returnOffsetDays, departureWeekdays, sortOrder,
    })),
    seededPatterns,
  )
})

test('bus uses distinct outbound Sunday/Thursday and return Monday/Friday operating days', () => {
  const schedule = config()
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-01' }), { ok: true })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-02' }), { ok: false, reason: 'not_operating_day' })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'return', date: '2026-03-02' }), { ok: true })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'return', date: '2026-03-05' }), { ok: false, reason: 'not_operating_day' })
})

test('hiace operates on demand every day', () => {
  assert.deepEqual(checkServiceDate(config(), { transferType: 'hiace', direction: 'outbound', date: '2026-03-03' }), { ok: true })
})

test('blackouts close scheduled and on-demand services, and beat extras', () => {
  const schedule = config()
  schedule.exceptions.push(
    { transferType: 'package_bus', direction: 'outbound', serviceDate: '2026-03-05', kind: 'blackout', isActive: true },
    { transferType: 'hiace', direction: 'outbound', serviceDate: '2026-03-03', kind: 'blackout', isActive: true },
    { transferType: 'package_bus', direction: 'outbound', serviceDate: '2026-03-10', kind: 'extra', isActive: true },
    { transferType: 'package_bus', direction: 'outbound', serviceDate: '2026-03-10', kind: 'blackout', isActive: true },
  )
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-05' }), { ok: false, reason: 'blackout' })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'hiace', direction: 'outbound', date: '2026-03-03' }), { ok: false, reason: 'blackout' })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-10' }), { ok: false, reason: 'blackout' })
})

test('an extra date opens Tuesday bus service', () => {
  const schedule = config()
  schedule.exceptions.push({ transferType: 'package_bus', direction: 'outbound', serviceDate: '2026-03-10', kind: 'extra', isActive: true })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-10' }), { ok: true })
})

test('origin-specific and seasonal rules only apply within their scopes', () => {
  const schedule = config()
  schedule.weeklyRules = [
    { transferType: 'package_bus', direction: 'outbound', weekday: 2, originGovernorateCode: 'cairo', isActive: true },
    { transferType: 'package_bus', direction: 'outbound', weekday: 3, validFrom: '2026-03-01', validTo: '2026-03-31', isActive: true },
  ]
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-03', originCode: 'cairo' }), { ok: true })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-03', originCode: 'giza' }), { ok: false, reason: 'not_operating_day' })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-04' }), { ok: true })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-04-01' }), { ok: false, reason: 'not_operating_day' })
})

test('unknown and inactive services have distinct failures', () => {
  const schedule = config()
  schedule.services[0].isActive = false
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'package_bus', direction: 'outbound', date: '2026-03-05' }), { ok: false, reason: 'service_inactive' })
  assert.deepEqual(checkServiceDate(schedule, { transferType: 'unknown', direction: 'outbound', date: '2026-03-05' }), { ok: false, reason: 'unknown_service' })
})

test('stay patterns only resolve sellable outbound and return combinations', () => {
  const schedule = config()
  assert.deepEqual(resolveStayPattern(schedule, { patternCode: 'bus_4d3n', transferType: 'package_bus', outboundDate: '2026-03-05' }), {
    ok: true, returnDate: '2026-03-09', nights: 3, durationDays: 4,
  })
  assert.deepEqual(resolveStayPattern(schedule, { patternCode: 'bus_4d3n', transferType: 'package_bus', outboundDate: '2026-03-01' }), {
    ok: false, reason: 'invalid_departure_weekday',
  })
  schedule.exceptions.push({ transferType: 'package_bus', direction: 'return', serviceDate: '2026-03-09', kind: 'blackout', isActive: true })
  assert.deepEqual(resolveStayPattern(schedule, { patternCode: 'bus_4d3n', transferType: 'package_bus', outboundDate: '2026-03-05' }), {
    ok: false, reason: 'return_not_operating',
  })
  assert.deepEqual(resolveStayPattern(config(), { patternCode: 'hiace_4d3n', transferType: 'hiace', outboundDate: '2026-03-03' }), {
    ok: true, returnDate: '2026-03-07', nights: 3, durationDays: 4,
  })
})

test('return options start strictly after outbound date', () => {
  assert.deepEqual(returnOptions(config(), { transferType: 'package_bus', outboundDate: '2026-03-05', count: 3 }), [
    '2026-03-06', '2026-03-09', '2026-03-13',
  ])
})

test('weekday calculation is UTC-stable around DST and midnight boundaries', () => {
  assert.equal(weekdayForDate('2026-03-29'), 0)
  assert.equal(weekdayForDate('2026-11-01'), 0)
  assert.equal(weekdayForDate('2026-01-01'), 4)
})

test('recommended check-in weekdays are guidance only', () => {
  const schedule = config()
  assert.equal(isRecommendedCheckIn(schedule, '2026-03-02'), true)
  assert.equal(isRecommendedCheckIn(schedule, '2026-03-06'), true)
  assert.equal(isRecommendedCheckIn(schedule, '2026-03-04'), false)
})
