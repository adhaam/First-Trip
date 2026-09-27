import { test } from 'node:test'
import assert from 'node:assert/strict'
import { paymentAllowedFor } from './payment-allowed'

const base = { entity_type: 'accommodation_booking' as const, status: 'awaiting_payment', journey_component: false, converted: false }

test('a journey component never takes payment directly, regardless of status', () => {
  assert.equal(paymentAllowedFor({ ...base, journey_component: true }, {}), false)
  assert.equal(paymentAllowedFor({ ...base, journey_component: true, status: 'confirmed' }, {}), false)
})

test('a standalone accommodation_booking follows the ledger paid_states', () => {
  assert.equal(paymentAllowedFor(base, {}), true)
  assert.equal(paymentAllowedFor({ ...base, status: 'new' }, {}), false)
  assert.equal(paymentAllowedFor({ ...base, status: 'completed' }, {}), true)
})

test('commerce_order uses its own paid_states, not the default ones', () => {
  const order = { ...base, entity_type: 'commerce_order' as const, status: 'preparing' }
  assert.equal(paymentAllowedFor(order, {}), true)
  assert.equal(paymentAllowedFor({ ...order, status: 'awaiting_payment' }, {}), false)
})

test('a trip_request only takes payment once converted and priced', () => {
  const journey = { ...base, entity_type: 'trip_request' as const, status: 'awaiting_payment', converted: true }
  assert.equal(paymentAllowedFor(journey, { agreed_total: 5000 }), true)
  assert.equal(paymentAllowedFor(journey, { agreed_total: null }), false, 'no agreed_total yet')
  assert.equal(paymentAllowedFor(journey, {}), false, 'agreed_total missing entirely')
  assert.equal(paymentAllowedFor({ ...journey, converted: false }, { agreed_total: 5000 }), false, 'not converted')
  assert.equal(paymentAllowedFor({ ...journey, status: 'new' }, { agreed_total: 5000 }), false, 'wrong status')
})
