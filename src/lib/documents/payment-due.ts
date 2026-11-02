/**
 * What a customer owes right now and later, derived ONLY from the agreed
 * total, the money the ledger says has been received, and the payment plan
 * (src/lib/payment-rules.ts). This module never decides a plan or a payment
 * kind and never changes a payment rule — it only subtracts.
 *
 *   dueNow   = max(0, plan.upfrontAmount - amountPaid)
 *   dueLater = max(0, total - amountPaid - dueNow)
 *
 * so paying the deposit moves "due now" to zero and leaves the arrival
 * balance; paying more than the deposit shrinks the later balance; and an
 * over-payment can never produce a negative figure.
 */
import type { PaymentPlan } from '@/lib/payment-rules'
import { amountOf, cents, fromCents } from './format'

export type PaymentDue = {
  total: number
  amountPaid: number
  /** total - amountPaid, never negative. */
  remaining: number
  /** null when the plan is per-quote (the amount is agreed with the team). */
  dueNow: number | null
  dueLater: number | null
  /** When the later balance falls due; null when none is due or the plan does not say. */
  laterTiming: 'on_arrival' | 'before_service' | null
  upfrontPercent: number | null
  rule: 'policy' | 'per_quote'
}

export function computePaymentDue(args: {
  total: number
  amountPaid: number
  plan: Pick<PaymentPlan, 'rule' | 'upfrontAmount' | 'upfrontPercent' | 'balanceDue'> | null | undefined
}): PaymentDue {
  const total = cents(Math.max(0, amountOf(args.total)))
  const paid = cents(Math.max(0, amountOf(args.amountPaid)))
  const remaining = Math.max(0, total - paid)
  const plan = args.plan
  if (!plan || plan.rule === 'per_quote' || plan.upfrontAmount === null || plan.upfrontAmount === undefined) {
    return {
      total: fromCents(total),
      amountPaid: fromCents(paid),
      remaining: fromCents(remaining),
      dueNow: null,
      dueLater: null,
      laterTiming: null,
      upfrontPercent: plan?.upfrontPercent ?? null,
      rule: 'per_quote',
    }
  }
  // The deposit can never exceed the total, and what is due now never exceeds what is left.
  const upfront = Math.min(total, cents(plan.upfrontAmount))
  const dueNow = Math.min(remaining, Math.max(0, upfront - paid))
  const dueLater = Math.max(0, total - paid - dueNow)
  return {
    total: fromCents(total),
    amountPaid: fromCents(paid),
    remaining: fromCents(remaining),
    dueNow: fromCents(dueNow),
    dueLater: fromCents(dueLater),
    laterTiming: dueLater > 0 ? plan.balanceDue ?? null : null,
    upfrontPercent: plan.upfrontPercent,
    rule: 'policy',
  }
}
