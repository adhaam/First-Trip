import assert from 'node:assert/strict'
import test from 'node:test'
import { mapRpcError } from './rpc-errors'

test('payment RPC business errors map to client errors', () => {
  assert.deepEqual(mapRpcError({ message: 'stale_payment_state', code: '40001' }), { status: 409, code: 'stale_payment_state' })
  for (const code of ['payment_before_confirmation', 'overpayment', 'refund_exceeds_paid', 'invalid_amount']) {
    assert.deepEqual(mapRpcError({ message: code, code: '23514' }), { status: 422, code })
  }
  assert.deepEqual(mapRpcError({ message: 'not_found', code: 'P0002' }), { status: 404, code: 'not_found' })
})

test('conversion RPC errors map to client errors', () => {
  assert.deepEqual(mapRpcError({ message: 'request_not_confirmed' }), { status: 409, code: 'request_not_confirmed' })
  for (const code of ['missing_accommodation', 'missing_quote_snapshot', 'snapshot_mismatch']) {
    assert.deepEqual(mapRpcError({ message: code }), { status: 422, code })
  }
})

test('a missing function or table means the migration is pending', () => {
  assert.deepEqual(mapRpcError({ message: 'Could not find the function', code: 'PGRST202' }), {
    status: 503, code: 'migration_pending',
  })
})

test('unknown errors are not mapped (the route returns a 500)', () => {
  assert.equal(mapRpcError({ message: 'connection reset', code: '08006' }), null)
  assert.equal(mapRpcError(null), null)
  // A message that merely contains a code is not that code.
  assert.equal(mapRpcError({ message: 'overpayment happened somewhere' }), null)
})

test('journey (migration 049) RPC errors map to client errors', () => {
  assert.deepEqual(mapRpcError({ message: 'component_of_journey' }), { status: 409, code: 'component_of_journey' })
  assert.deepEqual(mapRpcError({ message: 'journey_not_commercial' }), { status: 409, code: 'journey_not_commercial' })
  assert.deepEqual(
    mapRpcError({ message: 'journey_component_price_locked' }),
    { status: 422, code: 'journey_component_price_locked' },
  )
})
