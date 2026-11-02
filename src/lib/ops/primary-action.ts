import type { NextAction, OpsEntityType } from './types'

/**
 * Pure mapping from an item's derived next_action + the transitions the workflow allows into the
 * buttons the item screen renders: one prominent primary action, and a secondary "Other actions" group
 * with no duplicates. Kept free of React so the mapping can be unit-tested (see primary-action.test.ts).
 */

/** How confirmation is worded before a status change is applied. */
export type StatusConfirmKind = 'cancel' | 'complete' | 'reopen' | 'alternative'

export type StatusAction = {
  status: string
  /** Key under ops.item.statusAction (a verb phrase), or 'reopen' for a reopen transition. */
  labelKey: string
  /** Which confirmation dialog wording applies, or null when the change applies immediately. */
  confirm: StatusConfirmKind | null
  destructive: boolean
  reopen: boolean
}

export type PrimaryNoneReason = 'component' | 'completed' | 'cancelled' | 'reconcile' | 'waiting'

export type PrimaryAction =
  /** labelKey is under ops.item.statusAction (usually action.labelKey; 'agreeAlternative' for that one case). */
  | { kind: 'status'; action: StatusAction; labelKey: string }
  | { kind: 'amend' }
  | { kind: 'payments'; labelKey: 'collect_payment' | 'refund_due' }
  | { kind: 'convert' }
  | { kind: 'none'; reason: PrimaryNoneReason }

export type ItemActions = {
  primary: PrimaryAction
  /** Remaining valid status transitions, never including the primary's own status. */
  secondary: StatusAction[]
  /** Where the Edit/Revise-request control renders: in the primary slot, the secondary group, or nowhere. */
  amend: 'primary' | 'secondary' | null
  /** Where the convert control renders. */
  convert: 'primary' | 'secondary' | null
}

export type ResolveInput = {
  entityType: OpsEntityType
  status: string
  nextAction: NextAction
  allowedStatuses: readonly string[]
  journeyComponent: boolean
  canConvert: boolean
  paymentsVisible: boolean
}

/** Moving a closed item back to work. Transitions out of cancelled / completed are all reopens. */
export function isReopen(from: string, to: string): boolean {
  return to !== from && (from === 'cancelled' || from === 'completed')
}

function confirmFor(from: string, to: string): StatusConfirmKind | null {
  if (isReopen(from, to)) return 'reopen'
  if (to === 'cancelled') return 'cancel'
  if (to === 'completed') return 'complete'
  return null
}

function statusAction(from: string, to: string, confirmOverride?: StatusConfirmKind): StatusAction {
  const reopen = isReopen(from, to)
  return {
    status: to,
    labelKey: reopen ? 'reopen' : to,
    confirm: confirmOverride ?? confirmFor(from, to),
    destructive: to === 'cancelled',
    reopen,
  }
}

/**
 * next_action -> the status change that performs it, tried in order (first allowed wins).
 * Actions handled outside this table: agree_alternative, collect_payment, refund_due, convert_to_booking,
 * reconcile_payments, none.
 */
const NEXT_ACTION_STATUS: Partial<Record<NextAction, readonly string[]>> = {
  start_availability_check: ['checking_availability'],
  confirm_availability: ['awaiting_payment'],
  plan_signature: ['planning'],
  mark_completed: ['completed'],
  contact_customer: ['contacted'],
  confirm_order: ['confirmed'],
  prepare_order: ['preparing'],
  mark_ready: ['ready'],
  hand_over: ['out_for_delivery', 'completed'],
  complete_delivery: ['completed'],
}

function noneReason(status: string, nextAction: NextAction): PrimaryNoneReason {
  if (nextAction === 'reconcile_payments') return 'reconcile'
  if (status === 'completed') return 'completed'
  if (status === 'cancelled') return 'cancelled'
  return 'waiting'
}

export function resolveItemActions(input: ResolveInput): ItemActions {
  const { entityType, status, nextAction, journeyComponent, canConvert, paymentsVisible } = input

  const allowed = input.allowedStatuses.filter((candidate, index, all) => (
    candidate !== status && all.indexOf(candidate) === index
  ))

  // A journey component is fulfilment only (migration 049): payments, documents, revisions and the
  // next commercial step live on the parent journey, but its own supplier status (confirmed with the
  // supplier, completed, cancelled) is still tracked here — nothing propagates it from the parent.
  if (journeyComponent) {
    return {
      primary: { kind: 'none', reason: 'component' },
      secondary: allowed.map((candidate) => statusAction(status, candidate)),
      amend: null,
      convert: null,
    }
  }
  const isTripRequest = entityType === 'trip_request'

  let primary: PrimaryAction = { kind: 'none', reason: noneReason(status, nextAction) }

  if (nextAction === 'agree_alternative') {
    if (isTripRequest) {
      primary = { kind: 'amend' }
    } else if (allowed.includes('awaiting_payment')) {
      primary = {
        kind: 'status',
        action: statusAction(status, 'awaiting_payment', 'alternative'),
        labelKey: 'agreeAlternative',
      }
    }
  } else if (nextAction === 'collect_payment' || nextAction === 'refund_due') {
    if (paymentsVisible) primary = { kind: 'payments', labelKey: nextAction }
  } else if (nextAction === 'convert_to_booking') {
    if (canConvert) primary = { kind: 'convert' }
  } else {
    const target = (NEXT_ACTION_STATUS[nextAction] ?? []).find((candidate) => allowed.includes(candidate))
    if (target) {
      const built = statusAction(status, target)
      primary = {
        kind: 'status',
        action: built,
        labelKey: built.labelKey,
      }
    }
  }

  const primaryStatus = primary.kind === 'status' ? primary.action.status : null
  const secondary = allowed
    .filter((candidate) => candidate !== primaryStatus)
    .map((candidate) => statusAction(status, candidate))

  return {
    primary,
    secondary,
    amend: isTripRequest ? (primary.kind === 'amend' ? 'primary' : 'secondary') : null,
    convert: canConvert ? (primary.kind === 'convert' ? 'primary' : 'secondary') : null,
  }
}
