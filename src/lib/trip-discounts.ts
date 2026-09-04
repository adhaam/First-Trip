// ─── Sinai Trip discount validation (migration 022) ───
//
// Shared by the admin create + update routes so the two can never drift.
// The runtime pricing side lives in lib/pricing.ts (effectiveTripPrice) —
// this file only guards what gets written.
//
// The DB CHECK constraints in migration 022 cover the single-column rules
// (valid type, non-negative value, percent <= 100, sane window). What SQL
// deliberately does NOT cover is "a flat amount must not exceed the trip's
// price", because a cross-column constraint would block lowering a trip's
// price while a discount is set. That rule is enforced here instead.

import { z } from 'zod'
import type { TripDiscountType } from './types'

/**
 * Timestamps reach this schema from two shapes that a strict `.datetime()`
 * would both reject: Postgres round-trips as `+00:00`-offset ISO (the admin
 * form re-submits the row it loaded), and `<input type="datetime-local">`
 * yields `2026-09-04T10:00` with no zone at all. Accept anything Date can
 * parse and normalise to UTC ISO so what lands in the column is uniform.
 */
const flexibleTimestamp = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value, ctx) => {
    if (value === null || value === undefined || value === '') return null
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'Expected a valid date/time' })
      return z.NEVER
    }
    return new Date(parsed).toISOString()
  })

export const tripDiscountFields = {
  // NULL is the absence of a discount — the DB CHECK allows only these two
  // values, matching the Signature Experiences convention.
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_starts_at: flexibleTimestamp,
  discount_ends_at: flexibleTimestamp,
}

interface DiscountShape {
  discount_type?: TripDiscountType | null
  discount_value?: number | null
  discount_starts_at?: string | null
  discount_ends_at?: string | null
  price?: number
}

/**
 * Cross-field rules that mirror the migration's CHECK constraints, so a bad
 * payload fails with a readable field error instead of a raw Postgres
 * constraint violation. `price` is only present on the create schema — the
 * "amount <= price" check for a partial update runs in
 * assertDiscountFitsPrice() once the stored price is known.
 */
export function validateTripDiscount(data: DiscountShape, ctx: z.RefinementCtx): void {
  const type = data.discount_type ?? null
  const value = data.discount_value ?? 0

  // A type with no value is not an error — it is how the 13 existing trips
  // are already stored, and effectiveTripPrice() reads it as "no discount".
  // Only a value WITHOUT a type is contradictory.
  if (type === null && value > 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['discount_type'],
      message: 'Pick a discount type, or clear the discount value',
    })
  }

  if (type === 'percentage' && value > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['discount_value'],
      message: 'A percentage discount cannot exceed 100',
    })
  }

  if (type === 'amount' && data.price !== undefined && value > data.price) {
    ctx.addIssue({
      code: 'custom',
      path: ['discount_value'],
      message: 'A flat discount cannot exceed the trip price',
    })
  }

  const startsAt = data.discount_starts_at ? Date.parse(data.discount_starts_at) : null
  const endsAt = data.discount_ends_at ? Date.parse(data.discount_ends_at) : null
  if (startsAt !== null && endsAt !== null && startsAt > endsAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['discount_ends_at'],
      message: 'The discount window cannot end before it starts',
    })
  }
}

/**
 * For a PATCH, `price` and `discount_value` can arrive independently — either
 * one alone can break the "amount <= price" rule against the stored row. The
 * caller resolves both against the current row and passes the effective pair.
 *
 * Returns an error message, or null when the combination is valid.
 */
export function assertDiscountFitsPrice(
  discountType: TripDiscountType | null,
  discountValue: number,
  price: number,
): string | null {
  if (discountType !== 'amount') return null
  if (discountValue > price) {
    return `A flat discount of ${discountValue} cannot exceed the trip price of ${price}`
  }
  return null
}
