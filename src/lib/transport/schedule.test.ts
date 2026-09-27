import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { DEFAULT_TRANSPORT_SCHEDULE } from './defaults'
import {
  checkServiceDate,
  findStayPattern,
  isRecommendedCheckIn,
  resolveStayPattern,
  returnOptions,
  weekdayForDate,
} from './schedule'
import type { TransportScheduleConfig } from './schedule'

function config(): TransportScheduleConfig {
  return structuredClone(DEFAULT_TRANSPORT_SCHEDULE)
}

test('migration 029 + 050 seeds and defaults agree on weekly rules and stay patterns', () => {
  const sql = readFileSync('supabase/migrations/029_transport_schedule.sql', 'utf8')
    + readFileSync('supabase/migrations/050_stay_patterns_8d7n_and_custom.sql', 'utf8')
  const seededRules = [...sql.matchAll(/\('package_bus',\s*'(outbound|return)',\s*(\d+),/g)]
    .map((match) => ({ direction: match[1], weekday: Number(match[2]) }))
  assert.deepEqual(
    DEFAULT_TRANSPORT_SCHEDULE.weeklyRules.map(({ direction, weekday }) => ({ direction, weekday })),
    seededRules,
  )

  const seededPatterns = [...sql.matchAll(
    /\('([^']+)',\s*'([^']+)',\s*'[^']*',\s*'[^']*',\s*(\d+),\s*(\d+),\s*(\d+),\s*(ARRAY\[([\d,\s]+)\]::SMALLINT\[\]|NULL),\s*(\d+)\)/g,
  )].map((match) => ({
    code: match[1], transferType: match[2], durationDays: Number(match[3]), nights: Number(match[4]),
    returnOffsetDays: Number(match[5]),
    departureWeekdays: match[6] === 'NULL' ? null : match[7].split(',').map(Number),
    sortOrder: Number(match[8]),
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

test('findStayPattern selects the lowest-sort active compatible pattern', () => {
  const schedule = config()
  schedule.stayPatterns.push(
    {
      code: 'any_6d5n', transferType: null, nameAr: '', nameEn: '6 days / 5 nights',
      durationDays: 6, nights: 5, returnOffsetDays: 6, isActive: true, sortOrder: 3,
    },
    {
      code: 'hiace_6d5n', transferType: 'hiace', nameAr: '', nameEn: '6 days / 5 nights',
      durationDays: 6, nights: 5, returnOffsetDays: 6, isActive: true, sortOrder: 2,
    },
    {
      code: 'inactive_hiace_6d5n', transferType: 'hiace', nameAr: '', nameEn: '6 days / 5 nights',
      durationDays: 6, nights: 5, returnOffsetDays: 6, isActive: false, sortOrder: 0,
    },
  )

  assert.equal(findStayPattern(schedule, { transferType: 'hiace', durationDays: 6 })?.code, 'hiace_6d5n')
  assert.equal(findStayPattern(schedule, { transferType: 'package_bus', durationDays: 6 })?.code, 'any_6d5n')
  assert.equal(findStayPattern(schedule, { transferType: 'hiace', durationDays: 7 }), null)
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

test('bus 8D/7N runs Thursday → following Friday and Sunday → following Monday only', () => {
  const schedule = config()
  const bus = (outboundDate: string) =>
    resolveStayPattern(schedule, { patternCode: 'bus_8d7n', transferType: 'package_bus', outboundDate })
  assert.deepEqual(bus('2026-03-05'), { ok: true, returnDate: '2026-03-13', nights: 7, durationDays: 8 })
  assert.deepEqual(bus('2026-03-01'), { ok: true, returnDate: '2026-03-09', nights: 7, durationDays: 8 })
  assert.deepEqual(bus('2026-03-03'), { ok: false, reason: 'invalid_departure_weekday' })
})

test('hiace 8D/7N is on demand on any day', () => {
  assert.deepEqual(
    resolveStayPattern(config(), { patternCode: 'hiace_8d7n', transferType: 'hiace', outboundDate: '2026-03-03' }),
    { ok: true, returnDate: '2026-03-11', nights: 7, durationDays: 8 },
  )
})

test('WEEMAP Bus commercial patterns are exactly Thu 4D/3N, Sun 5D/4N and Thu/Sun 8D/7N', () => {
  const schedule = config()
  const bus = (patternCode: string, outboundDate: string) =>
    resolveStayPattern(schedule, { patternCode, transferType: 'package_bus', outboundDate })
  // 2026-03-05 is a Thursday, 2026-03-01 a Sunday.
  assert.deepEqual(bus('bus_4d3n', '2026-03-05'), { ok: true, returnDate: '2026-03-09', nights: 3, durationDays: 4 })
  assert.deepEqual(bus('bus_4d3n', '2026-03-01'), { ok: false, reason: 'invalid_departure_weekday' })
  assert.deepEqual(bus('bus_5d4n', '2026-03-01'), { ok: true, returnDate: '2026-03-06', nights: 4, durationDays: 5 })
  assert.deepEqual(bus('bus_5d4n', '2026-03-05'), { ok: false, reason: 'invalid_departure_weekday' })
  assert.deepEqual(bus('bus_8d7n', '2026-03-05'), { ok: true, returnDate: '2026-03-13', nights: 7, durationDays: 8 })
  assert.deepEqual(bus('bus_8d7n', '2026-03-01'), { ok: true, returnDate: '2026-03-09', nights: 7, durationDays: 8 })
  const busPatterns = schedule.stayPatterns.filter((pattern) => pattern.transferType === 'package_bus')
  assert.deepEqual(busPatterns.map(({ code, departureWeekdays }) => [code, departureWeekdays]), [
    ['bus_4d3n', [4]], ['bus_5d4n', [0]], ['bus_8d7n', [0, 4]],
  ])
})
