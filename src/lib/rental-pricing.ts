/**
 * Reusable server-side rental pricing logic. Shared by the public request
 * API and the admin quoting UI so pricing is never computed independently
 * in the browser and never duplicated between the two call sites.
 *
 * Rental pricing is tier-based (not a single daily rate): admins configure
 * an arbitrary set of durations per product/variant (e.g. 1/3/7/14/30 days,
 * or just 1/7/30 — nothing is hard-coded here).
 */

export interface RentalPricingTier {
  id: string
  product_id: string
  variant_id: string | null
  duration_days: number
  price: number
  is_active: boolean
}

export interface RentalQuoteInput {
  tiers: RentalPricingTier[]
  variantId?: string | null
  requestedDays: number
  quantity: number
}

/**
 * How a quote was derived — see quoteRental() for the full rule.
 *  - 'exact':      a tier with exactly requestedDays exists.
 *  - 'rounded_up': no exact tier; the smallest tier covering requestedDays.
 *  - 'pro_rata':   requestedDays is longer than every tier; billed at the
 *                  longest tier's per-day rate for every requested day.
 */
export type RentalPricingRule = 'exact' | 'rounded_up' | 'pro_rata'

export interface RentalQuoteResult {
  /** The tier the price is derived from (the longest tier for 'pro_rata'). */
  tier: RentalPricingTier
  /** Days the customer is charged for AND the reservation must cover.
   *  Always >= requestedDays. */
  durationDays: number
  quantity: number
  unitPrice: number
  subtotal: number
  /** True when requestedDays didn't exactly match a tier and we picked the
   *  closest tier that covers at least that many days (never undercharges). */
  roundedUp: boolean
  rule: RentalPricingRule
}

/** Deterministic tier ordering: shorter first; for duplicate durations the
 *  cheaper tier wins, then the lower id — never DB row order. */
function compareTiers(a: RentalPricingTier, b: RentalPricingTier): number {
  if (a.duration_days !== b.duration_days) return a.duration_days - b.duration_days
  const priceDiff = Number(a.price) - Number(b.price)
  if (priceDiff !== 0) return priceDiff
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Rounds to piastres (2 dp) without float drift on typical EGP amounts. */
function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Selects the best matching pricing tier for a variant (or product-level
 * tiers when no variant applies) and computes the authoritative subtotal.
 *
 * Tier scope: variant-specific tiers when the variant has any active ones;
 * otherwise the product-level ("whole product", variant_id NULL) tiers. That
 * fallback is what lets a simple rental — one default variant carrying the
 * owned inventory, priced by whole-product tiers — be quoted at all.
 *
 * Selection rule (deterministic, independent of DB row order):
 *  1. Exact duration_days match → that tier's price.
 *  2. Otherwise the smallest tier whose duration_days >= requestedDays
 *     (rounded up — never silently undercharges). The customer is charged
 *     for, and the reservation covers, the tier's full duration.
 *  3. requestedDays longer than EVERY tier → 'pro_rata': the longest tier's
 *     per-day rate × requestedDays, rounded to piastres. e.g. with a 30-day
 *     tier at 8,500 a 45-day rental is 8,500 / 30 × 45 = 12,750. The quote
 *     (and therefore the reservation) covers all requestedDays — previously
 *     this case charged and reserved only the longest tier's days.
 *
 * Durations covered by a tier (1 and 2) price exactly as before.
 */
export function quoteRental(input: RentalQuoteInput): RentalQuoteResult | null {
  const { tiers, variantId, requestedDays, quantity } = input
  if (!Number.isInteger(requestedDays) || !Number.isInteger(quantity)) return null
  if (requestedDays <= 0 || quantity <= 0) return null

  const active = tiers.filter((t) => t.is_active && Number(t.duration_days) > 0)
  const variantTiers = variantId ? active.filter((t) => t.variant_id === variantId) : []
  const scoped = (variantTiers.length > 0 ? variantTiers : active.filter((t) => t.variant_id === null))
    .slice()
    .sort(compareTiers)
  if (scoped.length === 0) return null

  const covering = scoped.find((t) => t.duration_days >= requestedDays)
  if (covering) {
    const unitPrice = Number(covering.price)
    return {
      tier: covering,
      durationDays: covering.duration_days,
      quantity,
      unitPrice,
      subtotal: roundMoney(unitPrice * quantity),
      roundedUp: covering.duration_days !== requestedDays,
      rule: covering.duration_days === requestedDays ? 'exact' : 'rounded_up',
    }
  }

  // Longer than every tier: longest tier; among equal-longest, the cheapest.
  const longestDays = scoped[scoped.length - 1].duration_days
  const longest = scoped.find((t) => t.duration_days === longestDays)!
  const unitPrice = roundMoney((Number(longest.price) * requestedDays) / longest.duration_days)
  return {
    tier: longest,
    durationDays: requestedDays,
    quantity,
    unitPrice,
    subtotal: roundMoney(unitPrice * quantity),
    roundedUp: false,
    rule: 'pro_rata',
  }
}

/** Refundable rental deposit for a line. Truthful to the product's
 *  admin-configured `deposit_amount` (migration 015) — per unit, never added
 *  to the rental price or order total. Invalid/negative values → 0. */
export function rentalDepositFor(depositPerUnit: unknown, quantity: number): { perUnit: number; total: number } {
  const perUnit = Math.max(0, Number(depositPerUnit) || 0)
  return { perUnit, total: roundMoney(perUnit * Math.max(0, quantity)) }
}

/** Sums line-item subtotals into an order-level subtotal. Pure helper — no I/O. */
export function sumSubtotals(amounts: number[]): number {
  return amounts.reduce((sum, n) => sum + n, 0)
}

export interface DeliveryFeeInput {
  fulfillmentMethod: 'pickup' | 'delivery'
  zone?: { fee_type: 'fixed' | 'free' | 'quote'; fixed_fee: number } | null
}

/**
 * Server-side delivery fee resolution. 'quote' zones resolve to 0 here —
 * the actual fee is settled manually over WhatsApp and never trusted from
 * the client; the order stays in a status requiring confirmation.
 */
export function resolveDeliveryFee(input: DeliveryFeeInput): number {
  if (input.fulfillmentMethod === 'pickup') return 0
  if (!input.zone) return 0
  if (input.zone.fee_type === 'fixed') return Number(input.zone.fixed_fee) || 0
  return 0
}
