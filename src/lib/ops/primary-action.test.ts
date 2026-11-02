import { test } from 'node:test'
import assert from 'node:assert/strict'
import { allowedNextStatuses, type RequestStatus } from '@/lib/request-workflow'
import { OPS_ENTITY_TABLES, type NextAction, type OpsEntityType } from './types'
import { isReopen, resolveItemActions, type ResolveInput } from './primary-action'

function input(entityType: OpsEntityType, status: string, nextAction: NextAction, patch: Partial<ResolveInput> = {}): ResolveInput {
  const domain = OPS_ENTITY_TABLES[entityType]!.domain
  const allowedStatuses = allowedNextStatuses(domain, status as RequestStatus<typeof domain>).filter((s) => s !== status)
  return {
    entityType, status, nextAction, allowedStatuses,
    journeyComponent: false, canConvert: false, paymentsVisible: true, ...patch,
  }
}

function primaryStatus(result: ReturnType<typeof resolveItemActions>) {
  return result.primary.kind === 'status' ? result.primary.action.status : null
}

test('start_availability_check -> checking_availability, no duplicate in secondary', () => {
  const r = resolveItemActions(input('accommodation_booking', 'new', 'start_availability_check'))
  assert.equal(primaryStatus(r), 'checking_availability')
  assert.ok(!r.secondary.some((a) => a.status === 'checking_availability'))
  assert.deepEqual(r.secondary.map((a) => a.status), ['pending', 'cancelled'])
})

test('confirm_availability -> awaiting_payment with the request-payment label', () => {
  const r = resolveItemActions(input('trip_booking', 'checking_availability', 'confirm_availability'))
  assert.equal(primaryStatus(r), 'awaiting_payment')
  assert.equal(r.primary.kind === 'status' && r.primary.labelKey, 'awaiting_payment')
  assert.ok(!r.secondary.some((a) => a.status === 'awaiting_payment'))
  assert.ok(r.secondary.some((a) => a.status === 'alternatives_required'))
  assert.ok(r.secondary.some((a) => a.status === 'cancelled' && a.destructive && a.confirm === 'cancel'))
})

test('agree_alternative on a trip_request opens the amend flow, awaiting_payment stays secondary', () => {
  const r = resolveItemActions(input('trip_request', 'alternatives_required', 'agree_alternative'))
  assert.equal(r.primary.kind, 'amend')
  assert.equal(r.amend, 'primary')
  assert.ok(r.secondary.some((a) => a.status === 'awaiting_payment'))
})

test('agree_alternative elsewhere -> awaiting_payment after a confirmation dialog', () => {
  const r = resolveItemActions(input('accommodation_booking', 'alternatives_required', 'agree_alternative'))
  assert.equal(primaryStatus(r), 'awaiting_payment')
  assert.equal(r.primary.kind === 'status' && r.primary.action.confirm, 'alternative')
  assert.equal(r.primary.kind === 'status' && r.primary.labelKey, 'agreeAlternative')
  assert.equal(r.amend, null)
  assert.ok(!r.secondary.some((a) => a.status === 'awaiting_payment'))
})

test('trip_request outside agree_alternative keeps Revise in the secondary group', () => {
  const r = resolveItemActions(input('trip_request', 'new', 'start_availability_check'))
  assert.equal(r.amend, 'secondary')
})

test('collect_payment and refund_due point at the payments panel, only when the payments panel is shown', () => {
  assert.deepEqual(resolveItemActions(input('accommodation_booking', 'awaiting_payment', 'collect_payment')).primary, { kind: 'payments', labelKey: 'collect_payment' })
  assert.deepEqual(resolveItemActions(input('accommodation_booking', 'cancelled', 'refund_due')).primary, { kind: 'payments', labelKey: 'refund_due' })
  const blocked = resolveItemActions(input('accommodation_booking', 'awaiting_payment', 'collect_payment', { paymentsVisible: false }))
  assert.equal(blocked.primary.kind, 'none')
})

test('convert_to_booking uses the convert control, only while convertible', () => {
  const r = resolveItemActions(input('trip_request', 'confirmed', 'convert_to_booking', { canConvert: true }))
  assert.equal(r.primary.kind, 'convert')
  assert.equal(r.convert, 'primary')
  assert.equal(resolveItemActions(input('trip_request', 'confirmed', 'convert_to_booking', { canConvert: false })).primary.kind, 'none')
  // Still reachable if a different action leads.
  assert.equal(resolveItemActions(input('trip_request', 'new', 'start_availability_check', { canConvert: true })).convert, 'secondary')
})

test('mark_completed -> completed with a confirmation; cancel stays secondary', () => {
  const r = resolveItemActions(input('accommodation_booking', 'confirmed', 'mark_completed'))
  assert.equal(primaryStatus(r), 'completed')
  assert.equal(r.primary.kind === 'status' && r.primary.action.confirm, 'complete')
  assert.deepEqual(r.secondary.map((a) => a.status), ['cancelled'])
})

test('reopen transitions are labelled Reopen and confirmed', () => {
  assert.equal(isReopen('cancelled', 'new'), true)
  assert.equal(isReopen('completed', 'confirmed'), true)
  assert.equal(isReopen('confirmed', 'completed'), false)
  assert.equal(isReopen('new', 'new'), false)

  const cancelled = resolveItemActions(input('trip_booking', 'cancelled', 'none'))
  assert.equal(cancelled.primary.kind, 'none')
  assert.deepEqual(cancelled.secondary.map((a) => [a.status, a.labelKey, a.confirm, a.reopen]), [['new', 'reopen', 'reopen', true]])

  const completed = resolveItemActions(input('commerce_order', 'completed', 'none'))
  assert.deepEqual(completed.secondary.map((a) => [a.status, a.labelKey, a.confirm]), [['confirmed', 'reopen', 'reopen']])
})

test('none: no primary button, with a reason', () => {
  assert.deepEqual(resolveItemActions(input('accommodation_booking', 'confirmed', 'none')).primary, { kind: 'none', reason: 'waiting' })
  assert.deepEqual(resolveItemActions(input('accommodation_booking', 'completed', 'none')).primary, { kind: 'none', reason: 'completed' })
  assert.deepEqual(resolveItemActions(input('trip_request', 'confirmed', 'reconcile_payments')).primary, { kind: 'none', reason: 'reconcile' })
})

test('journey components get no commercial action — only their own fulfilment status changes', () => {
  const r = resolveItemActions({
    ...input('accommodation_booking', 'awaiting_payment', 'collect_payment', { journeyComponent: true, canConvert: true }),
    allowedStatuses: ['confirmed', 'cancelled'],
  })
  assert.deepEqual(r.primary, { kind: 'none', reason: 'component' })
  assert.equal(r.amend, null)
  assert.equal(r.convert, null)
  assert.deepEqual(r.secondary.map((action) => action.status), ['confirmed', 'cancelled'])
})

test('commerce next actions map onto the matching status (pickup skips out_for_delivery)', () => {
  assert.equal(primaryStatus(resolveItemActions(input('commerce_order', 'new', 'contact_customer'))), 'contacted')
  assert.equal(primaryStatus(resolveItemActions(input('commerce_order', 'ready', 'hand_over'))), 'out_for_delivery')
  const pickup = resolveItemActions({ ...input('commerce_order', 'ready', 'hand_over'), allowedStatuses: ['completed', 'cancelled'] })
  assert.equal(primaryStatus(pickup), 'completed')
})

test('no action is ever listed twice, across every entity/status/next_action combination', () => {
  const actions: NextAction[] = [
    'start_availability_check', 'confirm_availability', 'plan_signature', 'agree_alternative', 'convert_to_booking',
    'collect_payment', 'mark_completed', 'refund_due', 'contact_customer', 'confirm_order', 'prepare_order',
    'mark_ready', 'hand_over', 'complete_delivery', 'reconcile_payments', 'none',
  ]
  const statuses = [
    'new', 'pending', 'contacted', 'checking_availability', 'planning', 'alternatives_required', 'awaiting_payment',
    'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled',
  ]
  for (const [entityType, config] of Object.entries(OPS_ENTITY_TABLES)) {
    for (const status of statuses) {
      for (const nextAction of actions) {
        for (const canConvert of [true, false]) {
          const r = resolveItemActions(input(entityType as OpsEntityType, status, nextAction, { canConvert }))
          const targets = r.secondary.map((a) => a.status)
          const label = `${config!.domain}/${status}/${nextAction}`
          assert.equal(new Set(targets).size, targets.length, label)
          assert.ok(!targets.includes(status), label)
          if (r.primary.kind === 'status') assert.ok(!targets.includes(r.primary.action.status), label)
          if (r.primary.kind === 'convert') assert.equal(r.convert, 'primary', label)
        }
      }
    }
  }
})
