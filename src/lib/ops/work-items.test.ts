import assert from 'node:assert/strict'
import test from 'node:test'
import { DEFAULT_PAYMENT_POLICIES } from '@/lib/payment-rules'
import {
  deriveWorkItem, filterByView, isCommercialItem, isJourneyItem, isTripItem, todayCounts, type WorkItemRow,
} from './work-items'
import type { AttentionCode } from './types'
import {
  journeyNoPaymentParent, journeyPackageComponent, journeyParentStayAnd3Trips, journeyStayAnd3Trips,
  journeyStayComponent, journeyTransportOnlyComponent, journeyTransportOnlyParent, journeyTripComponent1,
  journeyWithPackageParent, legacyJourneyNeedingReconcile, standalonePackage, standaloneTransfer, standaloneTrip,
} from './__fixtures__/journeys'

const NOW = new Date('2026-09-25T12:00:00Z')
const TODAY = '2026-09-25'

const base: WorkItemRow = {
  entity_type: 'accommodation_booking', entity_id: '1', reference: 'R', subtype: null,
  payment_kind: 'stay_package', customer_id: null, customer_name: 'A', customer_phone: '1',
  status: 'new', payment_status: 'unpaid', amount_total: 8960, amount_paid: 0,
  start_date: '2026-10-02', end_date: '2026-10-04', people: 2, title_en: '', title_ar: '',
  transfer_type: null, source: 'website', trip_request_id: null,
  created_at: '2026-09-20T00:00:00Z', updated_at: '2026-09-20T00:00:00Z',
  journey_component: false, converted: false,
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

test('c. edition_request next_action is mapped purely by status: new/contacted need action, confirmed/closed do not', () => {
  assert.equal(derive({ entity_type: 'edition_request', status: 'new', payment_kind: null }).next_action, 'contact_customer')
  assert.equal(derive({ entity_type: 'edition_request', status: 'contacted', payment_kind: null }).next_action, 'confirm_or_close')
  assert.equal(derive({ entity_type: 'edition_request', status: 'confirmed', payment_kind: null }).next_action, 'none')
  assert.equal(derive({ entity_type: 'edition_request', status: 'closed', payment_kind: null }).next_action, 'none')
})

test('c. edition_request needs_action follows next_action, not payment (edition_requests carry no payment_kind)', () => {
  const newRequest = derive({ entity_type: 'edition_request', status: 'new', payment_kind: null, amount_total: null })
  const contacted = derive({ entity_type: 'edition_request', status: 'contacted', payment_kind: null, amount_total: null })
  const confirmed = derive({ entity_type: 'edition_request', status: 'confirmed', payment_kind: null, amount_total: null })
  const closed = derive({ entity_type: 'edition_request', status: 'closed', payment_kind: null, amount_total: null })
  assert.equal(newRequest.needs_action, true)
  assert.equal(contacted.needs_action, true)
  assert.equal(confirmed.needs_action, false)
  assert.equal(closed.needs_action, false)
  // No payment_kind -> no policy pricing derived for an Experience request.
  assert.equal(newRequest.upfront_due, null)
  assert.equal(newRequest.outstanding_now, null)
})

test('d. trip_request: converted rows never need conversion again', () => {
  // A converted journey behaves like any other payable booking: awaiting_payment still owes money.
  assert.equal(
    derive({
      entity_type: 'trip_request', status: 'awaiting_payment', payment_status: 'partial',
      converted: true, amount_paid: 8960,
    }).next_action,
    'collect_payment',
  )
  assert.equal(
    derive({
      entity_type: 'trip_request', status: 'confirmed', payment_status: 'partial', converted: true,
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

test('d. trip_request: converted but not commercial (legacy payment_status "converted") needs reconcile_payments', () => {
  const item = derive({
    entity_type: 'trip_request', status: 'confirmed', payment_status: 'converted', converted: true,
    start_date: '2026-09-10', end_date: '2026-09-20',
  })
  assert.equal(item.next_action, 'reconcile_payments')
  assert.equal(item.needs_action, true)
})

test('journey component rows never collect_payment or refund_due, regardless of status', () => {
  const collectCandidate = derive({
    entity_type: 'accommodation_booking', journey_component: true, status: 'awaiting_payment',
  })
  assert.equal(collectCandidate.next_action, 'none')
  const refundCandidate = derive({
    entity_type: 'trip_booking', journey_component: true, status: 'cancelled', amount_paid: 500,
  })
  assert.equal(refundCandidate.next_action, 'none')
  assert.equal(refundCandidate.attention.includes('refund_due'), false)
  assert.equal(collectCandidate.attention.includes('unpaid_close_to_service'), false)
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

test('arrivals are stays/transfers and unconverted requests; trips are never arrivals', () => {
  const stay = derive({ status: 'confirmed', start_date: '2026-09-25' })
  const trip = derive({ entity_type: 'trip_booking', status: 'confirmed', start_date: '2026-09-25' })
  const converted = derive({ entity_type: 'trip_request', status: 'confirmed', converted: true })
  const cancelled = derive({ status: 'cancelled', start_date: '2026-09-25' })
  assert.equal(isJourneyItem(stay), true)
  assert.equal(isJourneyItem(trip), false)
  assert.equal(isJourneyItem(converted), false)
  assert.equal(isJourneyItem(cancelled), false)
  assert.equal(isTripItem(trip), true)
  const counts = todayCounts([stay, trip, cancelled], '2026-09-25')
  assert.equal(counts.arrivals_today, 1)
  assert.equal(counts.trips_today, 1)
})

const deriveRow = (row: WorkItemRow) => deriveWorkItem(row, { now: NOW, today: TODAY, policies: DEFAULT_PAYMENT_POLICIES })

test('journey: one commercial row per journey in every view (BYT stay + 3 trips)', () => {
  const items = journeyStayAnd3Trips.map(deriveRow)
  assert.equal(items.filter(isCommercialItem).length, 1)
  for (const view of ['all', 'needs_action', 'awaiting_payment', 'stale', 'exceptions', 'upcoming'] as const) {
    const shown = filterByView(items, view, TODAY)
    assert(shown.length <= 1, `view ${view} should surface at most the one commercial journey row`)
    for (const item of shown) assert.equal(item.journey_component, false)
  }
})

test('journey: children never collect_payment, even when their own math would owe money', () => {
  const stayComponent = deriveRow(journeyStayComponent)
  const tripComponent = deriveRow(journeyTripComponent1)
  assert.equal(stayComponent.next_action, 'none')
  assert.equal(tripComponent.next_action, 'none')
  assert.equal(stayComponent.needs_action, false)
  assert.equal(tripComponent.needs_action, false)
})

test('journey: parent upfront_due is 50% of the journey total (payment_kind "journey")', () => {
  const parent = deriveRow(journeyParentStayAnd3Trips)
  assert.equal(parent.upfront_due, 6000)
  assert.equal(parent.outstanding_now, 0) // amount_paid 6000 already covers the 50% upfront
})

test('journey: transport-only and package-only journeys also collapse to one commercial row', () => {
  const transportItems = [journeyTransportOnlyParent, journeyTransportOnlyComponent].map(deriveRow)
  assert.equal(transportItems.filter(isCommercialItem).length, 1)
  assert.equal(deriveRow(journeyTransportOnlyComponent).next_action, 'none')

  const packageItems = [journeyWithPackageParent, journeyPackageComponent].map(deriveRow)
  assert.equal(packageItems.filter(isCommercialItem).length, 1)
  assert.equal(deriveRow(journeyPackageComponent).next_action, 'none')
})

test('standalone trip/package/transfer are priced at 100% upfront, not the journey 50%', () => {
  assert.equal(deriveRow(standaloneTrip).upfront_due, 1500)
  assert.equal(deriveRow(standaloneTrip).outstanding_now, 1500)
  assert.equal(deriveRow(standalonePackage).upfront_due, 3000)
  assert.equal(deriveRow(standaloneTransfer).upfront_due, 800)
})

test('journey with no payment terms yet: converted with legacy marker needs reconcile_payments', () => {
  const item = deriveRow(journeyNoPaymentParent)
  assert.equal(item.next_action, 'reconcile_payments')
  assert.equal(item.needs_action, true)
  assert.equal(item.upfront_due, null) // amount_total is null, so no policy amount can be derived
})

test('legacy journey needing manual financial review maps to reconcile_payments', () => {
  const item = deriveRow(legacyJourneyNeedingReconcile)
  assert.equal(item.next_action, 'reconcile_payments')
  assert.equal(item.needs_action, true)
})

test('journey: trips_today counts component trip_bookings, unlike every other today-count', () => {
  const items = [journeyParentStayAnd3Trips, journeyStayComponent, journeyTripComponent1].map(deriveRow)
  const counts = todayCounts(items, '2026-10-06') // journeyTripComponent1.start_date
  assert.equal(counts.trips_today, 1)
})

test('journey: arrivals are not double-counted (component stay counts, converted parent does not)', () => {
  const items = [journeyParentStayAnd3Trips, journeyStayComponent].map(deriveRow)
  const counts = todayCounts(items, '2026-10-05') // both share this start_date
  assert.equal(counts.arrivals_today, 1)
})
