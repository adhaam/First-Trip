import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PAYMENT_POLICIES } from '@/lib/payment-rules'
import { deriveWorkItem, filterByView, type WorkItemRow } from './work-items'
import type { AttentionCode } from './types'

const NOW = new Date('2026-09-25T12:00:00Z')
const TODAY = '2026-09-25'

const base: WorkItemRow = {
  entity_type: 'accommodation_booking', entity_id: '1', reference: 'R', subtype: null,
  payment_kind: 'stay_package', customer_id: null, customer_name: 'A', customer_phone: '1',
  status: 'new', payment_status: 'unpaid', amount_total: 8960, amount_paid: 0,
  start_date: '2026-10-02', end_date: '2026-10-04', people: 2, title_en: '', title_ar: '',
  transfer_type: null, source: 'website', trip_request_id: null,
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
}

const derive = (patch: Partial<WorkItemRow> = {}) => deriveWorkItem(
  { ...base, ...patch },
  { now: NOW, today: TODAY, policies: DEFAULT_PAYMENT_POLICIES },
)
const has = (patch: Partial<WorkItemRow>, code: AttentionCode) => derive(patch).attention.includes(code)

test('a. cancelled -> refund_due when money is held, none otherwise', () => {
  assert.equal(derive({ status: 'cancelled', amount_paid: 1 }).next_action, 'refund_due')
  assert.equal(derive({ status: 'cancelled', amount_paid: 0 }).next_action, 'none')
})

test('b. completed -> none', () => {
  assert.equal(derive({ status: 'completed' }).next_action, 'none')
  assert.equal(derive({ entity_type: 'commerce_order', status: 'completed' }).next_action, 'none')
})

test('c. commerce_order next_action is mapped purely by status, never by payment', () => {
  const commerce = [
    'contact_customer', 'confirm_order', 'prepare_order', 'mark_ready', 'hand_over', 'complete_delivery',
  ]
  const statuses = ['new', 'contacted', 'confirmed', 'preparing', 'ready', 'out_for_delivery']
  for (const [index, status] of statuses.entries()) {
    assert.equal(derive({ entity_type: 'commerce_order', status }).next_action, commerce[index])
  }
  // A confirmed commerce order owes nothing (no policy payment_kind) yet must still say prepare_order,
  // not collect_payment -- payments never drive commerce actions.
  assert.equal(derive({ entity_type: 'commerce_order', status: 'confirmed' }).next_action, 'prepare_order')
})

test('d. trip_request: converted rows never need conversion again', () => {
  assert.equal(
    derive({ entity_type: 'trip_request', status: 'awaiting_payment', payment_status: 'converted' }).next_action,
    'none',
  )
  assert.equal(
    derive({
      entity_type: 'trip_request', status: 'confirmed', payment_status: 'converted',
      start_date: '2026-09-10', end_date: '2026-09-20',
    }).next_action,
    'mark_completed',
  )
})

test('d. trip_request: unconverted with confirmed availability needs conversion before anything else', () => {
  assert.equal(
    derive({ entity_type: 'trip_request', status: 'awaiting_payment', payment_status: null }).next_action,
    'convert_to_booking',
  )
  // Even a passed, unconverted, confirmed request must be converted first, not marked completed.
  assert.equal(
    derive({
      entity_type: 'trip_request', status: 'confirmed', payment_status: null,
      start_date: '2026-09-10', end_date: '2026-09-20',
    }).next_action,
    'convert_to_booking',
  )
})

test('e. confirmed and the service date has passed -> mark_completed', () => {
  assert.equal(derive({ status: 'confirmed', end_date: '2026-09-24', amount_paid: 8960 }).next_action, 'mark_completed')
})

test('f. payment collection', () => {
  assert.equal(derive({ status: 'awaiting_payment' }).next_action, 'collect_payment')
  assert.equal(derive({ status: 'confirmed', amount_paid: 0, start_date: '2026-09-27' }).next_action, 'collect_payment')
  assert.equal(derive({ status: 'confirmed', amount_paid: 4480, start_date: '2026-09-27' }).next_action, 'none')
})

test('g. availability / planning workflow', () => {
  assert.equal(derive({ status: 'new' }).next_action, 'start_availability_check')
  assert.equal(derive({ status: 'checking_availability' }).next_action, 'confirm_availability')
  assert.equal(derive({ status: 'alternatives_required' }).next_action, 'agree_alternative')
  assert.equal(derive({ entity_type: 'signature_request', status: 'new' }).next_action, 'plan_signature')
  assert.equal(derive({ entity_type: 'signature_request', status: 'contacted' }).next_action, 'plan_signature')
  assert.equal(derive({ entity_type: 'signature_request', status: 'planning' }).next_action, 'plan_signature')
})

test('policy payment amounts: stay_package 50%, trip 100%', () => {
  const item = derive({ status: 'confirmed', amount_paid: 4480, start_date: '2026-09-27' })
  assert.equal(item.upfront_due, 4480)
  assert.equal(item.outstanding_now, 0)
  assert.equal(derive({ payment_kind: 'trip', amount_total: 1000, status: 'confirmed' }).upfront_due, 1000)
})

test('per-quote payment kinds (signature) never derive an upfront amount', () => {
  const item = derive({ payment_kind: 'signature', status: 'confirmed' })
  assert.equal(item.upfront_due, null)
  assert.equal(item.outstanding_now, null)
})

test('attention: unpaid_close_to_service', () => {
  const code = 'unpaid_close_to_service'
  assert(has({ status: 'confirmed', amount_paid: 0, start_date: '2026-09-26' }, code))
  assert(!has({ status: 'confirmed', amount_paid: 4480, start_date: '2026-09-26' }, code)) // paid in full
  assert(!has({ status: 'confirmed', amount_paid: 0, start_date: '2026-10-10' }, code)) // too far away
  assert(!has({ status: 'confirmed', amount_paid: 0, start_date: '2026-09-20' }, code)) // already passed
})

test('attention: service_passed_not_completed', () => {
  const code = 'service_passed_not_completed'
  assert(has({ status: 'confirmed', end_date: '2026-09-24', amount_paid: 8960 }, code))
  assert(!has({ status: 'awaiting_payment', end_date: '2026-09-24' }, code)) // not confirmed
  assert(!has({ status: 'confirmed', end_date: '2026-09-30', amount_paid: 8960 }, code)) // not passed yet
})

test('attention: refund_due', () => {
  assert(has({ status: 'cancelled', amount_paid: 1 }, 'refund_due'))
  assert(!has({ status: 'cancelled', amount_paid: 0 }, 'refund_due'))
})

test('attention: stale', () => {
  assert(has({ status: 'new' }, 'stale'))
  assert(!has({ status: 'new', created_at: '2026-09-25T11:00:00Z' }, 'stale')) // recently changed
})

test('attention: transfer_unconfirmed', () => {
  const code = 'transfer_unconfirmed'
  assert(has({ transfer_type: 'hiace', status: 'new', start_date: '2026-09-26' }, code))
  assert(!has({ transfer_type: 'hiace', status: 'confirmed', start_date: '2026-09-26', amount_paid: 8960 }, code))
  assert(!has({ transfer_type: 'hiace', status: 'cancelled', start_date: '2026-09-26' }, code)) // cancelled
  assert(!has({ transfer_type: 'hiace', status: 'new', start_date: '2026-10-10' }, code)) // too far away
})

test('filters each queue view', () => {
  const items = [
    // new, start_date 2026-10-02 (in the upcoming window), stale, needs_action
    derive(),
    // collect_payment, same far-off start_date -> no unpaid_close_to_service
    derive({ entity_id: '2', status: 'awaiting_payment' }),
    // mark_completed, passed
    derive({
      entity_id: '3', status: 'confirmed', end_date: '2026-09-24', amount_paid: 8960, start_date: '2026-09-18',
    }),
  ]
  assert.equal(filterByView(items, 'needs_action', TODAY).length, 2)
  assert.equal(filterByView(items, 'awaiting_payment', TODAY).length, 1)
  assert.equal(filterByView(items, 'stale', TODAY).length, 2)
  assert.equal(filterByView(items, 'exceptions', TODAY).length, 1)
  assert.equal(filterByView(items, 'upcoming', TODAY).length, 2)
  assert.equal(filterByView(items, 'all', TODAY).length, 3)
})

test('upcoming excludes cancelled rows even inside the window', () => {
  const items = [derive({ status: 'cancelled', start_date: '2026-09-27' })]
  assert.equal(filterByView(items, 'upcoming', TODAY).length, 0)
})
