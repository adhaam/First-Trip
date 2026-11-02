export type PaymentKind =
  | 'stay'
  | 'stay_package'
  | 'transfer'
  | 'trip'
  | 'experience_package'
  | 'signature'
  | 'commerce'
  | 'rental'
  | 'journey'

export type PaymentPolicy = {
  booking_kind: PaymentKind
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
  { booking_kind: 'stay', upfront_percent: 50, upfront_due: 'after_confirmation', balance_due: 'on_arrival' },
  { booking_kind: 'stay_package', upfront_percent: 50, upfront_due: 'after_confirmation', balance_due: 'on_arrival' },
  { booking_kind: 'transfer', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
  { booking_kind: 'trip', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
  { booking_kind: 'experience_package', upfront_percent: 100, upfront_due: 'after_confirmation', balance_due: null },
  { booking_kind: 'journey', upfront_percent: 50, upfront_due: 'after_confirmation', balance_due: 'on_arrival' },
]

/** The seed values in supabase/migrations/030_payment_policies.sql. */
export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethod[] = [
  { code: 'vodafonecash', name_ar: 'فودافون كاش', name_en: 'Vodafone Cash', on_request_only: false, sort_order: 0 },
  { code: 'instapay', name_ar: 'إنستاباي', name_en: 'InstaPay', on_request_only: false, sort_order: 1 },
  { code: 'cash', name_ar: 'كاش', name_en: 'Cash', on_request_only: false, sort_order: 2 },
  { code: 'card_link', name_ar: 'رابط دفع فيزا / ماستركارد', name_en: 'Visa / Mastercard payment link', on_request_only: true, sort_order: 3 },
]

type PaymentKindRow = {
  payment_kind?: PaymentKind | null
  booking_type?: string | null
  trip_package_id?: string | null
  trip_package_payment_kind?: PaymentKind | null
  trip_package?: { payment_kind?: PaymentKind | null } | null
  trip_packages?: { payment_kind?: PaymentKind | null } | null
  table?: string | null
  entity_type?: string | null
}

/**
 * Resolves the stored payment classification. Legacy fallbacks exist only while
 * migration 030 is rolling out: package contents and request context must never
 * be used to decide how a package is paid.
 */
export function paymentKindFor(row: PaymentKind | PaymentKindRow): PaymentKind {
  if (typeof row === 'string') return row
  if (row.payment_kind) return row.payment_kind

  if (row.trip_package_id) {
    return row.trip_package_payment_kind
      ?? row.trip_package?.payment_kind
      ?? row.trip_packages?.payment_kind
      ?? 'experience_package'
  }

  if ('trip_package_id' in row || row.table === 'trip_bookings' || row.entity_type === 'trip_bookings') return 'trip'

  switch (row.booking_type) {
    case 'package': return 'stay_package'
    case 'accommodation-only': return 'stay'
    case 'transfer-only': return 'transfer'
    default: throw new Error('Cannot determine payment kind')
  }
}

type JourneyComposition = { transport_mode?: string | null; accommodation_id?: string | null }

/** Payment kinds a journey can be quoted with; anything else stored is a pre-049 per-parts plan. */
const JOURNEY_PLAN_KINDS: readonly PaymentKind[] = ['journey', 'trip', 'transfer']

/**
 * The payment kind a Build Your Trip journey (a trip_requests row) is priced
 * with, from its actual commercial composition (founder decision 2026-11-02):
 *   - any accommodation           → 'journey'  (50% after confirmation, 50% on arrival)
 *   - trips / packages only       → 'trip'     (100% after confirmation)
 *   - transport, with or without
 *     trips, no accommodation     → 'transfer' (100% after confirmation)
 * Never from the mere fact that the request came through Build Your Trip.
 */
export function journeyPaymentKind(row: JourneyComposition): PaymentKind {
  if (row.accommodation_id) return 'journey'
  return row.transport_mode && row.transport_mode !== 'stay_only' ? 'transfer' : 'trip'
}

/**
 * The payment kind a journey was actually quoted with at its current revision
 * (trip_requests.payment_plan.kind), so terms already agreed with a customer
 * never change under them; a new quote or an amendment writes a fresh plan
 * from journeyPaymentKind. A stored pre-049 per-parts plan keeps the 'journey'
 * terms every converted journey has had since 049; no stored plan at all
 * falls back to the composition. Mirrored by ops_work_items (migration 052).
 */
export function agreedJourneyPaymentKind(row: JourneyComposition & { payment_plan?: unknown }): PaymentKind {
  const plan = row.payment_plan
  if (plan && typeof plan === 'object') {
    const kind = (plan as { kind?: unknown }).kind
    return typeof kind === 'string' && JOURNEY_PLAN_KINDS.includes(kind as PaymentKind) ? kind as PaymentKind : 'journey'
  }
  return journeyPaymentKind(row)
}

/** Self-arrival (no WEEMAP transport) and no accommodation: only trips / trip packages. */
export function isTripsOnlyJourney(row: { transport_mode?: string | null; accommodation_id?: string | null }): boolean {
  return row.transport_mode === 'stay_only' && !row.accommodation_id
}

export type PaymentPlan = {
  kind: PaymentKind
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

export function paymentPlan(kind: PaymentKind, total: number, policies: readonly PaymentPolicy[] = DEFAULT_PAYMENT_POLICIES): PaymentPlan {
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

export function paymentPlanForParts(parts: readonly { kind: PaymentKind, total: number }[], policies: readonly PaymentPolicy[] = DEFAULT_PAYMENT_POLICIES): CombinedPaymentPlan {
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
