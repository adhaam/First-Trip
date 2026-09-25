import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_TRANSPORT_SCHEDULE } from './defaults'
import type { TransportScheduleConfig } from './schedule'
import {
  checkStayPatternOperable,
  exceptionCreateSchema,
  patternsBrokenBy,
  stayPatternCreateSchema,
  stayPatternUpdateSchema,
  weeklyRuleCreateSchema,
} from './admin-validation'

// Seeded truth (migration 029): the shared bus goes out Sun/Thu and back Mon/Fri;
// the private Hiace runs on demand.
function config(): TransportScheduleConfig {
  return structuredClone({ ...DEFAULT_TRANSPORT_SCHEDULE, exceptions: [] }) as TransportScheduleConfig
}

const pattern = (patch: Partial<Parameters<typeof checkStayPatternOperable>[1]> = {}) => ({
  code: 'test', transfer_type: 'package_bus', return_offset_days: 4, departure_weekdays: [4], is_active: true, ...patch,
})

test('the seeded bus patterns are operable', () => {
  assert.deepEqual(checkStayPatternOperable(config(), pattern()), { ok: true }) // Thu → Mon
  assert.deepEqual(checkStayPatternOperable(config(), pattern({ departure_weekdays: [0], return_offset_days: 5 })), {
    ok: true, // Sun → Fri
  })
  assert.deepEqual(patternsBrokenBy(config()), [])
})

test('a bus pattern that returns on a day without a return service is rejected', () => {
  const result = checkStayPatternOperable(config(), pattern({ return_offset_days: 3 })) // Thu → Sun
  assert.deepEqual(result, { ok: false, problems: [{ transfer_type: 'package_bus', weekday: 0, direction: 'return' }] })
})

test('a bus pattern departing on a day without an outbound service is rejected', () => {
  const result = checkStayPatternOperable(config(), pattern({ departure_weekdays: [2] })) // Tuesday
  assert.deepEqual(result, { ok: false, problems: [{ transfer_type: 'package_bus', weekday: 2, direction: 'outbound' }] })
})

test('on-demand services accept any weekday and offset', () => {
  assert.deepEqual(
    checkStayPatternOperable(config(), pattern({ transfer_type: 'hiace', departure_weekdays: null, return_offset_days: 2 })),
    { ok: true },
  )
})

test('a pattern for every service is checked against each scheduled one', () => {
  const result = checkStayPatternOperable(config(), pattern({ transfer_type: null, departure_weekdays: [3] }))
  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.problems.every((problem) => problem.transfer_type === 'package_bus'))
})

test('inactive patterns are not checked; inactive services are skipped', () => {
  assert.deepEqual(checkStayPatternOperable(config(), pattern({ departure_weekdays: [2], is_active: false })), { ok: true })
  const busOff = config()
  busOff.services = busOff.services.map((service) => ({ ...service, isActive: service.transferType !== 'package_bus' }))
  assert.deepEqual(checkStayPatternOperable(busOff, pattern({ departure_weekdays: [2] })), { ok: true })
})

test('deactivating the Monday return rule breaks the Thursday 4-day pattern', () => {
  const changed = config()
  changed.weeklyRules = changed.weeklyRules.map((rule) =>
    rule.direction === 'return' && rule.weekday === 1 ? { ...rule, isActive: false } : rule)
  const broken = patternsBrokenBy(changed)
  assert.ok(broken.some((entry) => entry.code === 'bus_4d3n'))
  assert.ok(!broken.some((entry) => entry.code.startsWith('hiace')))
})

test('switching the bus to on-demand never breaks a pattern', () => {
  const changed = config()
  changed.services = changed.services.map((service) => ({ ...service, scheduleMode: 'on_demand' as const }))
  changed.weeklyRules = []
  assert.deepEqual(patternsBrokenBy(changed), [])
})

test('weekly rule schema validates weekday, direction and season order', () => {
  const base = { transfer_type: 'package_bus', direction: 'outbound', weekday: 4 }
  assert.equal(weeklyRuleCreateSchema.safeParse(base).success, true)
  assert.equal(weeklyRuleCreateSchema.safeParse({ ...base, weekday: 7 }).success, false)
  assert.equal(weeklyRuleCreateSchema.safeParse({ ...base, direction: 'both' }).success, false)
  assert.equal(weeklyRuleCreateSchema.safeParse({ ...base, valid_from: '2026-11-01', valid_to: '2026-10-01' }).success, false)
  assert.equal(weeklyRuleCreateSchema.safeParse({ ...base, extra: 1 }).success, false)
})

test('exception schema validates kind, direction and date', () => {
  const base = { transfer_type: 'package_bus', direction: 'both', service_date: '2026-12-31', kind: 'blackout' }
  assert.equal(exceptionCreateSchema.safeParse(base).success, true)
  assert.equal(exceptionCreateSchema.safeParse({ ...base, kind: 'closed' }).success, false)
  assert.equal(exceptionCreateSchema.safeParse({ ...base, service_date: '2026-02-30' }).success, false)
  assert.equal(exceptionCreateSchema.safeParse({ ...base, reason_en: 'x'.repeat(301) }).success, false)
})

test('stay pattern schema keeps nights inside the duration and normalises weekdays', () => {
  const base = {
    code: 'bus_6d5n', transfer_type: 'package_bus', name_ar: 'ستة أيام', name_en: '6 days', duration_days: 6,
    nights: 5, return_offset_days: 6, departure_weekdays: [4, 0],
  }
  const parsed = stayPatternCreateSchema.safeParse(base)
  assert.ok(parsed.success)
  assert.deepEqual(parsed.success && parsed.data.departure_weekdays, [0, 4])
  assert.equal(stayPatternCreateSchema.safeParse({ ...base, nights: 6 }).success, false)
  assert.equal(stayPatternCreateSchema.safeParse({ ...base, code: 'Bus 6' }).success, false)
  assert.equal(stayPatternCreateSchema.safeParse({ ...base, departure_weekdays: [1, 1] }).success, false)
  assert.equal(stayPatternUpdateSchema.safeParse({ code: 'renamed' }).success, false)
})
