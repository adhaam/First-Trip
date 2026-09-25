export type BookingKind =
  | 'accommodation_package'
  | 'accommodation_stay'
  | 'transfer'
  | 'trip'
  | 'trip_package'
  | 'signature'
  | 'commerce'
  | 'rental'

export type PaymentPolicy = {
  booking_kind: BookingKind
  upfront_percent: number
  upfront_due: 'after_confirmation'
  balance_due: 'on_arrival' | 'before_service' | null
  is_active?: boolean
}

export type PaymentMethod = {
  code: string
  name_ar: string
  name_en: string
  on_request_only: boolean
  sort_order: number
  is_active?: boolean
}

/** The seed values in supabase/migrations/030_payment_policies.sql. */
export const DEFAULT_PAYMENT_POLICIES: readonly PaymentPolicy[] = [
  { booking_kind: 'accommodation_package', upfront_percent: 50, upfront_due: 'after_confirmation', balance_due: 'on_arrival' },
  { booking_kind: 'accommodation_stay', upfront_percent: 50, upfront_due: 'after_confirmation', balance_due: 'on_arrival' },
  { booking_kind: 'transfer', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
  { booking_kind: 'trip', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
  { booking_kind: 'trip_package', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
]

/** The seed values in supabase/migrations/030_payment_policies.sql. */
export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethod[] = [
  { code: 'vodafonecash', name_ar: 'فودافون كاش', name_en: 'Vodafone Cash', on_request_only: false, sort_order: 0 },
  { code: 'instapay', name_ar: 'إنستاباي', name_en: 'InstaPay', on_request_only: false, sort_order: 1 },
  { code: 'cash', name_ar: 'كاش', name_en: 'Cash', on_request_only: false, sort_order: 2 },
  { code: 'card_link', name_ar: 'رابط دفع فيزا / ماستركارد', name_en: 'Visa / Mastercard payment link', on_request_only: true, sort_order: 3 },
]

type BookingKindRow = {
  kind?: BookingKind
  booking_kind?: BookingKind
  booking_type?: string | null
  context?: string | null
  table?: string | null
  entity_type?: string | null
}

/** Maps request-table vocabulary to the policy vocabulary. */
export function bookingKindFor(row: BookingKind | BookingKindRow): BookingKind {
  if (typeof row === 'string') return row
  if (row.kind) return row.kind
  if (row.booking_kind) return row.booking_kind

  const table = row.table ?? row.entity_type
  if (table === 'trip_bookings' || row.context !== undefined) {
    return row.context === 'package' ? 'trip_package' : 'trip'
  }
  switch (row.booking_type) {
    case 'package': return 'accommodation_package'
    case 'accommodation-only': return 'accommodation_stay'
    case 'transfer-only': return 'transfer'
    default: throw new Error('Cannot determine payment booking kind')
  }
}

export type PaymentPlan = {
  kind: BookingKind
  rule: 'policy' | 'per_quote'
  upfrontPercent: number | null
  upfrontAmount: number | null
  balanceAmount: number | null
  upfrontDue: 'after_confirmation'
  balanceDue: 'on_arrival' | 'before_service' | null
  payableNow: false
}

function assertTotal(total: number) {
  if (!Number.isFinite(total) || total < 0) throw new TypeError('Payment total must be a non-negative finite number')
}

function roundHalfUp(value: number) {
  return Math.floor(value + 0.5)
}

export function paymentPlan(kind: BookingKind, total: number, policies: readonly PaymentPolicy[] = DEFAULT_PAYMENT_POLICIES): PaymentPlan {
  assertTotal(total)
  const policy = policies.find((candidate) => candidate.booking_kind === kind && candidate.is_active !== false)
  if (!policy) {
    return { kind, rule: 'per_quote', upfrontPercent: null, upfrontAmount: null, balanceAmount: null, upfrontDue: 'after_confirmation', balanceDue: null, payableNow: false }
  }
  const upfrontAmount = roundHalfUp(total * policy.upfront_percent / 100)
  return {
    kind,
    rule: 'policy',
    upfrontPercent: policy.upfront_percent,
    upfrontAmount,
    balanceAmount: total - upfrontAmount,
    upfrontDue: policy.upfront_due,
    balanceDue: policy.balance_due,
    payableNow: false,
  }
}

export type CombinedPaymentPlan = Omit<PaymentPlan, 'kind'> & {
  kind: 'combined'
  upfrontPercent: null
  balanceDue: null
}

export function paymentPlanForParts(parts: readonly { kind: BookingKind, total: number }[], policies: readonly PaymentPolicy[] = DEFAULT_PAYMENT_POLICIES): CombinedPaymentPlan {
  const plans = parts.map((part) => paymentPlan(part.kind, part.total, policies))
  const hasPerQuote = plans.some((plan) => plan.rule === 'per_quote')
  return {
    kind: 'combined',
    rule: hasPerQuote ? 'per_quote' : 'policy',
    upfrontPercent: null,
    upfrontAmount: hasPerQuote ? null : plans.reduce((sum, plan) => sum + (plan.upfrontAmount ?? 0), 0),
    balanceAmount: hasPerQuote ? null : plans.reduce((sum, plan) => sum + (plan.balanceAmount ?? 0), 0),
    upfrontDue: 'after_confirmation',
    balanceDue: null,
    payableNow: false,
  }
}
