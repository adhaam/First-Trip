import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_TRANSPORT_SCHEDULE } from '@/lib/transport/defaults'
import { bookingSchema, type BookingInput } from '@/lib/public-booking'
import { validateBookingDates } from './booking-date-validation'

function schedule() {
  return structuredClone(DEFAULT_TRANSPORT_SCHEDULE)
}

function booking(overrides: Partial<BookingInput>): BookingInput {
  return {
    customer_name: 'Test Customer',
    customer_phone: '201000000000',
    booking_type: 'package',
    accommodation_id: '00000000-0000-4000-8000-000000000001',
    governorate: 'cairo',
    trip_date: '2026-03-05',
    duration: 4,
    transfer_type: 'package_bus',
    transfer_direction: 'round_trip',
    num_people: 2,
    ...overrides,
  }
}

test('booking date validation accepts the Thursday 4-day bus package and derives Monday return', () => {
  const result = validateBookingDates(booking({}), schedule())
  assert.deepEqual(result, {
    ok: true,
    input: booking({ nights: 3, return_date: '2026-03-09' }),
  })
})

test('booking schema accepts configured-duration candidates before schedule validation', () => {
  const parsed = bookingSchema.safeParse(booking({ duration: 6 }))
  assert.equal(parsed.success, true)
})

test('booking date validation preserves the Sunday 5-day bus package behaviour', () => {
  const result = validateBookingDates(booking({ trip_date: '2026-03-01', duration: 5 }), schedule())
  assert.deepEqual(result, {
    ok: true,
    input: booking({ trip_date: '2026-03-01', duration: 5, nights: 4, return_date: '2026-03-06' }),
  })
})

test('booking date validation uses configured 6-day hiace pattern nights', () => {
  const configuredSchedule = schedule()
  configuredSchedule.stayPatterns.push({
    code: 'hiace_6d5n', transferType: 'hiace', nameAr: '', nameEn: '6 days / 5 nights',
    durationDays: 6, nights: 5, returnOffsetDays: 6, departureWeekdays: null, isActive: true, sortOrder: 4,
  })

  const result = validateBookingDates(booking({
    trip_date: '2026-03-03', duration: 6, transfer_type: 'hiace',
  }), configuredSchedule)
  assert.deepEqual(result, {
    ok: true,
    input: booking({
      trip_date: '2026-03-03', duration: 6, nights: 5, transfer_type: 'hiace', return_date: '2026-03-09',
    }),
  })
})

test('booking date validation rejects a package duration without an active pattern', () => {
  const result = validateBookingDates(booking({ duration: 6 }), schedule())
  assert.deepEqual(result, {
    ok: false,
    code: 'PACKAGE_STAY_PATTERN_UNAVAILABLE',
    error: 'The selected departure date is unavailable for this package.',
  })
})

test('booking date validation rejects a deactivated bus 4-day pattern', () => {
  const configuredSchedule = schedule()
  const pattern = configuredSchedule.stayPatterns.find((candidate) => candidate.code === 'bus_4d3n')
  assert.ok(pattern)
  pattern.isActive = false

  const result = validateBookingDates(booking({}), configuredSchedule)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, 'PACKAGE_STAY_PATTERN_UNAVAILABLE')
})

test('booking date validation rejects a Sunday 4-day bus package', () => {
  const result = validateBookingDates(booking({ trip_date: '2026-03-01' }), schedule())
  assert.deepEqual(result, {
    ok: false,
    code: 'PACKAGE_STAY_PATTERN_UNAVAILABLE',
    error: 'The selected departure date is unavailable for this package.',
  })
})

test('booking date validation rejects a blacked-out package departure', () => {
  const configuredSchedule = schedule()
  configuredSchedule.exceptions.push({
    transferType: 'package_bus',
    direction: 'outbound',
    serviceDate: '2026-03-05',
    kind: 'blackout',
    isActive: true,
  })

  const result = validateBookingDates(booking({}), configuredSchedule)
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.code, 'PACKAGE_STAY_PATTERN_UNAVAILABLE')
})

test('booking date validation accepts a configured extra Tuesday package departure', () => {
  const configuredSchedule = schedule()
  configuredSchedule.exceptions.push(
    {
      transferType: 'package_bus',
      direction: 'outbound',
      serviceDate: '2026-03-10',
      kind: 'extra',
      isActive: true,
    },
    {
      transferType: 'package_bus',
      direction: 'return',
      serviceDate: '2026-03-14',
      kind: 'extra',
      isActive: true,
    },
  )
  const pattern = configuredSchedule.stayPatterns.find((candidate) => candidate.code === 'bus_4d3n')
  assert.ok(pattern)
  pattern.departureWeekdays = [2]

  const result = validateBookingDates(booking({ trip_date: '2026-03-10' }), configuredSchedule)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.input.return_date, '2026-03-14')
})

test('booking date validation allows Monday from Dahab bus transfers and rejects Tuesday', () => {
  const monday = validateBookingDates(booking({
    booking_type: 'transfer-only',
    trip_date: '2026-03-02',
    transfer_direction: 'from_dahab',
  }), schedule())
  assert.equal(monday.ok, true)

  const tuesday = validateBookingDates(booking({
    booking_type: 'transfer-only',
    trip_date: '2026-03-03',
    transfer_direction: 'from_dahab',
  }), schedule())
  assert.equal(tuesday.ok, false)
  if (!tuesday.ok) assert.equal(tuesday.code, 'TRANSFER_RETURN_UNAVAILABLE')
})

test('booking date validation permits Hiace transfers and stay-only bookings on any day', () => {
  const hiace = validateBookingDates(booking({
    booking_type: 'transfer-only',
    trip_date: '2026-03-03',
    transfer_type: 'hiace',
    transfer_direction: 'to_dahab',
  }), schedule())
  assert.equal(hiace.ok, true)

  const stayOnly = validateBookingDates(booking({
    booking_type: 'accommodation-only',
    trip_date: '2026-03-03',
    transfer_type: undefined,
    duration: undefined,
  }), schedule())
  assert.equal(stayOnly.ok, true)
})

test('booking date validation rejects a client package return-date mismatch', () => {
  const result = validateBookingDates(booking({ return_date: '2026-03-13' }), schedule())
  assert.deepEqual(result, {
    ok: false,
    code: 'PACKAGE_RETURN_DATE_MISMATCH',
    error: 'The selected return date does not match the package schedule.',
  })
})
