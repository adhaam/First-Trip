import assert from 'node:assert/strict'
import test from 'node:test'
import {
  documentFilename,
  documentsMode,
  isAvailabilityConfirmed,
  localInputToIso,
  paymentBlockReason,
  receivedPayments,
  toLocalInputValue,
} from './documents-view'

test('availability is confirmed only from awaiting_payment onwards', () => {
  for (const status of ['awaiting_payment', 'confirmed', 'completed']) assert.equal(isAvailabilityConfirmed(status), true)
  for (const status of ['new', 'pending', 'checking_availability', 'planning', 'alternatives_required', 'cancelled', '']) {
    assert.equal(isAvailabilityConfirmed(status), false)
  }
  assert.equal(isAvailabilityConfirmed(null), false)
})

test('documentsMode picks the documents card per entity type', () => {
  assert.equal(documentsMode({ entity_type: 'trip_request', journey_component: false }), 'journey')
  assert.equal(documentsMode({ entity_type: 'accommodation_booking', journey_component: false }), 'booking')
  assert.equal(documentsMode({ entity_type: 'trip_booking', journey_component: false }), 'booking')
  assert.equal(documentsMode({ entity_type: 'accommodation_booking', journey_component: true }), 'component')
  assert.equal(documentsMode({ entity_type: 'trip_booking', journey_component: true }), 'component')
  assert.equal(documentsMode({ entity_type: 'signature_request', journey_component: false }), 'none')
  assert.equal(documentsMode({ entity_type: 'commerce_order', journey_component: false }), 'none')
  assert.equal(documentsMode({ entity_type: 'edition_request', journey_component: false }), 'none')
})

test('receivedPayments drops refunds', () => {
  const rows = [
    { id: 'a', direction: 'received' },
    { id: 'b', direction: 'refunded' },
    { id: 'c', direction: 'received' },
  ]
  assert.deepEqual(receivedPayments(rows).map((row) => row.id), ['a', 'c'])
  assert.deepEqual(receivedPayments([]), [])
})

test('paymentBlockReason tells the employee what to do', () => {
  assert.equal(paymentBlockReason({ entityType: 'trip_request', status: 'planning', converted: false }), 'convert_first')
  assert.equal(paymentBlockReason({ entityType: 'trip_request', status: 'awaiting_payment', converted: true }), null)
  assert.equal(paymentBlockReason({ entityType: 'trip_request', status: 'planning', converted: true }), 'awaiting_payment_first')
  assert.equal(paymentBlockReason({ entityType: 'accommodation_booking', status: 'pending' }), 'awaiting_payment_first')
  assert.equal(paymentBlockReason({ entityType: 'trip_booking', status: 'confirmed' }), null)
  assert.equal(paymentBlockReason({ entityType: 'commerce_order', status: 'pending' }), 'order_not_confirmed')
  assert.equal(paymentBlockReason({ entityType: 'commerce_order', status: 'preparing' }), null)
})

test('documentFilename is WEEMAP-prefixed and filesystem safe', () => {
  assert.equal(documentFilename('QT-2026-0007'), 'WEEMAP-QT-2026-0007.html')
  assert.equal(documentFilename('WR-AB12', 'rev', 3), 'WEEMAP-WR-AB12-rev-3.html')
  assert.equal(documentFilename('a/b c', null, ''), 'WEEMAP-a-b-c.html')
  assert.equal(documentFilename('WEEMAP-PQ-0001'), 'WEEMAP-PQ-0001.html')
  assert.equal(documentFilename(), 'WEEMAP-document.html')
})

test('local datetime input value uses local wall time, not UTC', () => {
  const date = new Date(2026, 4, 3, 7, 5) // 3 May 2026 07:05 local
  assert.equal(toLocalInputValue(date), '2026-05-03T07:05')
  // Round-trip: parsing the local string must give back the exact same instant.
  assert.equal(localInputToIso(toLocalInputValue(date)), date.toISOString())
  assert.equal(localInputToIso(''), undefined)
  assert.equal(localInputToIso('not-a-date'), undefined)
})
