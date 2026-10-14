import assert from 'node:assert/strict'
import test from 'node:test'
import { quoteErrorKey, recommendedAllocations, type QuoteView } from './view'

test('maps quote errors to stable message keys', () => {
  assert.equal(quoteErrorKey('SCHEDULE_BLACKOUT'), 'quoteScheduleError')
  assert.equal(quoteErrorKey('429'), 'quoteRateLimited')
  assert.equal(quoteErrorKey('OTHER'), 'quoteError')
})

test('maps room-plan errors to their own message keys', () => {
  assert.equal(quoteErrorKey('ROOMS_MANUAL_CONFIRMATION'), 'quoteRoomsManual')
  assert.equal(quoteErrorKey('ROOM_TYPE_UNAVAILABLE'), 'quoteRoomTypeUnavailable')
  assert.equal(quoteErrorKey('ROOM_CAPACITY_EXCEEDED'), 'quoteRoomsCapacity')
  assert.equal(quoteErrorKey('ROOMS_EXCEED_GUESTS'), 'quoteRoomsTooMany')
})

test('recommendedAllocations reads the server recommendation only for the quoted party size', () => {
  const rooms = {
    mode: 'custom' as const,
    people: 3,
    allocations: [{ type: 'single' as const, count: 3 }],
    accommodation_total: 9000,
    recommended: { allocations: [{ type: 'triple' as const, count: 1 }], accommodation_total: 4000 },
    difference: 5000,
    room_types: [],
  }
  const quote = { total: 9000, lines: [], payment: {} as QuoteView['payment'], rooms }
  assert.deepEqual(recommendedAllocations(quote, 3), [{ type: 'triple', count: 1 }])
  assert.equal(recommendedAllocations(quote, 4), undefined)
  assert.equal(recommendedAllocations(null, 3), undefined)
  const auto = { ...quote, rooms: { ...rooms, mode: 'recommended' as const, recommended: null } }
  assert.deepEqual(recommendedAllocations(auto, 3), [{ type: 'single', count: 3 }])
})
