import assert from 'node:assert/strict'
import test from 'node:test'

import { DEFAULT_TRANSPORT_SCHEDULE } from '@/lib/transport/defaults'
import type { BookingInput } from '@/lib/public-booking'
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
    input: booking({ return_date: '2026-03-09' }),
  })
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
