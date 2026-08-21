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

export interface RentalQuoteResult {
  tier: RentalPricingTier
  durationDays: number
  quantity: number
  unitPrice: number
  subtotal: number
  /** True when requestedDays didn't exactly match a tier and we picked the
   *  closest tier that covers at least that many days (never undercharges). */
  roundedUp: boolean
}

/**
 * Selects the best matching pricing tier for a variant (or product-level
 * tiers when no variant applies) and computes the authoritative subtotal.
 *
 * Selection rule: prefer an exact duration_days match. If none exists, pick
 * the smallest tier whose duration_days is >= requestedDays (never silently
 * undercharge a longer rental than any configured tier covers). If the
 * request exceeds every configured tier, the longest available tier is used
 * and the caller should treat the quote as a manual/WhatsApp-confirmed case.
 */
export function quoteRental(input: RentalQuoteInput): RentalQuoteResult | null {
  const { tiers, variantId, requestedDays, quantity } = input
  if (requestedDays <= 0 || quantity <= 0) return null

  const scoped = tiers.filter(
    (t) => t.is_active && (variantId ? t.variant_id === variantId : t.variant_id === null),
  )
  if (scoped.length === 0) return null

  const exact = scoped.find((t) => t.duration_days === requestedDays)
  const tier =
    exact ||
    scoped
      .filter((t) => t.duration_days >= requestedDays)
      .sort((a, b) => a.duration_days - b.duration_days)[0] ||
    scoped.sort((a, b) => b.duration_days - a.duration_days)[0]

  if (!tier) return null

  const unitPrice = Number(tier.price)
  const subtotal = unitPrice * quantity

  return {
    tier,
    durationDays: tier.duration_days,
    quantity,
    unitPrice,
    subtotal,
    roundedUp: tier.duration_days !== requestedDays,
  }
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
