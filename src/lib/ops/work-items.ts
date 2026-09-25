import { paymentPlan, type PaymentKind, type PaymentPolicy } from '@/lib/payment-rules'
import { STALE_HOURS, type AttentionCode, type NextAction, type WorkItem } from './types'

type DerivedFields =
  | 'next_action' | 'needs_action' | 'last_change_at' | 'waiting_hours'
  | 'stale' | 'attention' | 'upfront_due' | 'outstanding_now'

export type WorkItemRow = Omit<WorkItem, DerivedFields>

/** payment_kind values priced by payment_policies. Everything else (signature, commerce, rental) is per-quote. */
const POLICY_PAYMENT_KINDS: readonly string[] = ['stay', 'stay_package', 'transfer', 'trip', 'experience_package']

const COMMERCE_NEXT_ACTION: Record<string, NextAction> = {
  new: 'contact_customer',
  contacted: 'confirm_order',
  confirmed: 'prepare_order',
  preparing: 'mark_ready',
  ready: 'hand_over',
  out_for_delivery: 'complete_delivery',
}

type DeriveContext = { passed: boolean, outstanding_now: number | null }

/**
 * next_action precedence (see docs/m3/OPS_API_CONTRACT.md):
 *   a. cancelled -> refund_due (money held) or none
 *   b. completed -> none
 *   c. commerce_order -> mapped purely by status; payments never drive commerce actions
 *   d. trip_request -> converted rows only ever need mark_completed/none; unconverted
 *      rows with confirmed availability need convert_to_booking before anything else
 *   e. confirmed and the service date has passed -> mark_completed
 *   f. payment collection (awaiting_payment, or confirmed with money still owed)
 *   g. availability / planning workflow
 *   h. otherwise nothing for staff to do
 */
function deriveNextAction(row: WorkItemRow, ctx: DeriveContext): NextAction {
  if (row.status === 'cancelled') return (row.amount_paid ?? 0) > 0 ? 'refund_due' : 'none'
  if (row.status === 'completed') return 'none'

  if (row.entity_type === 'commerce_order') return COMMERCE_NEXT_ACTION[row.status] ?? 'none'

  if (row.entity_type === 'trip_request') {
    if (row.payment_status === 'converted') {
      return row.status === 'confirmed' && ctx.passed ? 'mark_completed' : 'none'
    }
    if (row.status === 'awaiting_payment' || row.status === 'confirmed') return 'convert_to_booking'
    // else: fall through to the shared payment / availability rules below
  }

  if (row.status === 'confirmed' && ctx.passed) return 'mark_completed'

  if (row.status === 'awaiting_payment') return 'collect_payment'
  if (row.status === 'confirmed' && (ctx.outstanding_now ?? 0) > 0) return 'collect_payment'

  if (row.entity_type === 'signature_request' && ['new', 'contacted', 'planning'].includes(row.status)) {
    return 'plan_signature'
  }
  if (['new', 'pending', 'contacted'].includes(row.status)) return 'start_availability_check'
  if (row.status === 'checking_availability') return 'confirm_availability'
  if (row.status === 'alternatives_required') return 'agree_alternative'

  return 'none'
}

function daysUntil(date: string | null, today: string): number | null {
  if (!date) return null
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000)
}

export function deriveWorkItem(
  row: WorkItemRow,
  input: { lastChangeAt?: string | null, now: Date, today: string, policies: readonly PaymentPolicy[] },
): WorkItem {
  const last_change_at = input.lastChangeAt ?? row.created_at
  const waiting_hours = Math.max(0, (input.now.getTime() - new Date(last_change_at).getTime()) / 3_600_000)
  const stale = STALE_HOURS[row.status] !== undefined && waiting_hours > STALE_HOURS[row.status]

  const hasPolicyKind = POLICY_PAYMENT_KINDS.includes(row.payment_kind ?? '')
  const upfront_due = hasPolicyKind && row.amount_total !== null
    ? paymentPlan(row.payment_kind as PaymentKind, row.amount_total, input.policies).upfrontAmount
    : null
  const paymentOpen = ['awaiting_payment', 'confirmed', 'completed'].includes(row.status)
  const outstanding_now = paymentOpen && upfront_due !== null
    ? Math.max(0, upfront_due - (row.amount_paid ?? 0))
    : null

  const serviceDate = row.end_date ?? row.start_date
  const passed = !!serviceDate && serviceDate < input.today
  const daysAway = daysUntil(row.start_date, input.today)

  const next_action = deriveNextAction(row, { passed, outstanding_now })

  const attention: AttentionCode[] = []
  if (
    ['confirmed', 'awaiting_payment'].includes(row.status)
    && (outstanding_now ?? 0) > 0
    && daysAway !== null && daysAway >= 0 && daysAway <= 2
  ) {
    attention.push('unpaid_close_to_service')
  }
  if (row.status === 'confirmed' && passed) attention.push('service_passed_not_completed')
  if (row.status === 'cancelled' && (row.amount_paid ?? 0) > 0) attention.push('refund_due')
  if (stale) attention.push('stale')
  if (
    row.transfer_type
    && !['confirmed', 'completed', 'cancelled'].includes(row.status)
    && daysAway !== null && daysAway >= 0 && daysAway <= 3
  ) {
    attention.push('transfer_unconfirmed')
  }

  const needs_action = !['none', 'collect_payment'].includes(next_action)
    || attention.includes('unpaid_close_to_service')

  return {
    ...row, next_action, needs_action, last_change_at, waiting_hours, stale, attention, upfront_due, outstanding_now,
  }
}

export type OpsView = 'needs_action' | 'awaiting_payment' | 'upcoming' | 'stale' | 'exceptions' | 'all'

export function filterByView(items: WorkItem[], view: OpsView, today: string): WorkItem[] {
  if (view === 'all') return items
  if (view === 'needs_action') return items.filter((item) => item.needs_action)
  if (view === 'awaiting_payment') return items.filter((item) => item.next_action === 'collect_payment')
  if (view === 'stale') return items.filter((item) => item.stale)
  if (view === 'exceptions') return items.filter((item) => item.attention.some((code) => code !== 'stale'))
  // upcoming: start_date in (today, today+7], not cancelled
  const upperBound = addDays(today, 7)
  return items.filter((item) => (
    item.status !== 'cancelled' && !!item.start_date && item.start_date > today && item.start_date <= upperBound
  ))
}

export function sortForView(items: WorkItem[], view: OpsView): WorkItem[] {
  return [...items].sort((a, b) => {
    if (view === 'upcoming') return (a.start_date ?? '').localeCompare(b.start_date ?? '')
    return a.last_change_at.localeCompare(b.last_change_at)
  })
}

export function todayCounts(items: WorkItem[], today: string) {
  return {
    needs_action: filterByView(items, 'needs_action', today).length,
    new_requests: items.filter((item) => ['new', 'pending', 'contacted'].includes(item.status)).length,
    awaiting_availability: items.filter((item) => item.status === 'checking_availability').length,
    alternatives_required: items.filter((item) => item.status === 'alternatives_required').length,
    awaiting_payment: filterByView(items, 'awaiting_payment', today).length,
    arrivals_today: items.filter((item) => item.start_date === today && item.status !== 'cancelled').length,
    departures_today: items.filter((item) => item.end_date === today && item.status !== 'cancelled').length,
    trips_today: items.filter((item) => (
      ['trip_booking', 'signature_request'].includes(item.entity_type) && item.start_date === today
    )).length,
    transfers_attention: items.filter((item) => item.attention.includes('transfer_unconfirmed')).length,
    stale: filterByView(items, 'stale', today).length,
    exceptions: filterByView(items, 'exceptions', today).length,
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
