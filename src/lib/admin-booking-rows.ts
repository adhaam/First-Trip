import { z } from 'zod'
import { DEFAULT_STAFF_BOOKING_SOURCE, STAFF_BOOKING_SOURCES } from './booking-sources'
import type { FindOrCreateCustomerInput } from './customer-resolution'
import type { PriceSnapshot, TripBookingPriceSnapshot } from './types'

/**
 * Pure request validation + row building for the two staff-created booking
 * paths (POST /api/admin/bookings and POST /api/admin/trip-bookings). Kept
 * out of the route files so the exact rows that reach the database are unit
 * tested (admin-booking-rows.test.ts) — no server-only / Supabase import.
 *
 * Both rows always carry `customer_id`, resolved by the caller through
 * findOrCreateCustomerByPhone, and a `source` from STAFF_BOOKING_SOURCES.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')

/** Where a staff-entered booking actually came from; defaults to 'manual'. */
const staffSource = z.enum(STAFF_BOOKING_SOURCES).optional().default(DEFAULT_STAFF_BOOKING_SOURCE)

// Manual booking entry — for bookings taken over the phone / WhatsApp / in
// person, so the dashboard stays the single source of truth for every
// booking regardless of where it came from. Skips the public-form validation
// (dates aren't restricted to Sun/Thu here since a manual booking can be
// anything the admin agreed to).
export const manualBookingSchema = z.object({
  customer_name: z.string().min(2).max(100),
  customer_phone: z.string().min(6).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  accommodation_id: z.string().uuid().optional().or(z.literal('')),
  governorate: z.string().max(40).optional().or(z.literal('')),
  trip_date: isoDate.optional().or(z.literal('')),
  return_date: isoDate.optional().or(z.literal('')),
  duration: z.union([z.literal(4), z.literal(5)]).optional(),
  nights: z.number().int().min(1).max(60).optional(),
  transfer_type: z.enum(['package_bus', 'hiace']).optional(),
  transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  room_type: z.enum(['double', 'single', 'triple']).optional(),
  meal_plan_key: z.string().optional().or(z.literal('')),
  extra_trip_ids: z.array(z.string().uuid()).optional(),
  trip_package_ids: z.array(z.string().uuid()).optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(1000).optional(),
  internal_notes: z.string().max(2000).optional(),
  status: z.enum(['new', 'pending', 'confirmed', 'cancelled', 'completed']).optional().default('confirmed'),
  total_price: z.number().min(0).optional(),
  /**
   * Set only when the employee deliberately overrode the computed price for
   * an exceptional case. Without it a client-sent total_price is ignored in
   * favour of the server's own calculation, so a stale or tampered form
   * cannot decide what a customer is charged.
   */
  price_override: z.boolean().optional(),
  price_override_reason: z.string().max(300).optional(),
  // Manual payment tracking — no gateway, just the owner's own records.
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  source: staffSource,
})

export type ManualBookingInput = z.infer<typeof manualBookingSchema>

export const adminTripBookingSchema = z.object({
  customer_name: z.string().min(1),
  customer_phone: z.string().min(5),
  trip_id: z.string().uuid(),
  preferred_date: z.string().optional().nullable(),
  num_people: z.number().int().min(1).default(1),
  quoted_price: z.number().optional().nullable(),
  /**
   * Honour the client-sent quoted_price only when the employee explicitly
   * overrode the calculated one. Otherwise the server prices the booking
   * itself.
   */
  price_override: z.boolean().optional(),
  price_override_reason: z.string().max(300).optional(),
  notes: z.string().optional().nullable(),
  source: staffSource,
})

export type AdminTripBookingInput = z.infer<typeof adminTripBookingSchema>

/** The findOrCreateCustomerByPhone input for a staff-entered booking. */
export function bookingCustomerInput(input: {
  customer_name: string
  customer_phone: string
  customer_email?: string | null
}): FindOrCreateCustomerInput {
  return {
    phone: input.customer_phone,
    name: input.customer_name,
    email: input.customer_email || null,
  }
}

/** The subset of computeQuote()'s result this module relies on. */
export type ManualQuoteOutcome =
  | { ok: true; total: number; snapshot: PriceSnapshot; normalizedSelections: { extraTripIds: string[]; tripPackageIds: string[] } }
  | { ok: false; error: string }

export interface ManualBookingPricing {
  totalPrice: number | undefined
  priceSnapshot: PriceSnapshot | null
  /** Set when a quote was attempted but failed and the typed total was kept. */
  pricingNote: string | null
  normalizedSelections: { extraTripIds: string[]; tripPackageIds: string[] } | null
}

/**
 * Authoritative pricing for a manual booking. `quote` is null when no quote
 * could be attempted (no start date yet) — the typed total is then kept.
 * A price override keeps the computed breakdown alongside the agreed total
 * so the invoice stays itemised and the difference auditable.
 */
export function resolveManualBookingPricing(
  input: Pick<ManualBookingInput, 'total_price' | 'price_override' | 'price_override_reason'>,
  quote: ManualQuoteOutcome | null,
): ManualBookingPricing {
  if (!quote) return { totalPrice: input.total_price, priceSnapshot: null, pricingNote: null, normalizedSelections: null }
  if (!quote.ok) return { totalPrice: input.total_price, priceSnapshot: null, pricingNote: quote.error, normalizedSelections: null }

  if (input.price_override && input.total_price !== undefined) {
    return {
      totalPrice: input.total_price,
      priceSnapshot: {
        ...quote.snapshot,
        price_override: true,
        computed_total: quote.total,
        ...(input.price_override_reason ? { price_override_reason: input.price_override_reason } : {}),
        total: input.total_price,
      },
      pricingNote: null,
      normalizedSelections: quote.normalizedSelections,
    }
  }
  return { totalPrice: quote.total, priceSnapshot: quote.snapshot, pricingNote: null, normalizedSelections: quote.normalizedSelections }
}

/** The `bookings` row inserted for a manual (staff-entered) booking. */
export function buildManualBookingRow(
  input: ManualBookingInput,
  pricing: Pick<ManualBookingPricing, 'totalPrice' | 'priceSnapshot' | 'normalizedSelections'>,
  customerId: string,
): Record<string, unknown> {
  // price_override / price_override_reason are request-only (they live in
  // price_snapshot), never bookings columns.
  /* eslint-disable @typescript-eslint/no-unused-vars */
  const {
    customer_email, accommodation_id, governorate, trip_date, return_date,
    meal_plan_key, extra_trip_ids, trip_package_ids,
    price_override: _priceOverride, price_override_reason: _priceOverrideReason,
    ...rest
  } = input
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return {
    ...rest,
    customer_id: customerId,
    customer_email: customer_email || null,
    accommodation_id: accommodation_id || null,
    governorate: governorate || null,
    trip_date: trip_date || null,
    return_date: return_date || null,
    meal_plan_key: meal_plan_key || null,
    extra_trip_ids: pricing.normalizedSelections?.extraTripIds ?? extra_trip_ids ?? [],
    trip_package_ids: pricing.normalizedSelections?.tripPackageIds ?? trip_package_ids ?? [],
    total_price: pricing.totalPrice ?? null,
    price_snapshot: pricing.priceSnapshot,
  }
}

/**
 * The `trip_bookings` row inserted for a staff-created standalone trip
 * booking. `computed` is the server-side snapshot (buildTripPriceSnapshot);
 * the client's quoted_price is honoured only on an explicit override.
 */
export function buildAdminTripBookingRow(
  input: AdminTripBookingInput,
  computed: TripBookingPriceSnapshot,
  customerId: string,
): Record<string, unknown> {
  const useOverride = Boolean(input.price_override) && input.quoted_price != null
  const quotedPrice = useOverride ? (input.quoted_price as number) : computed.total

  return {
    customer_id: customerId,
    customer_name: input.customer_name,
    customer_phone: input.customer_phone,
    trip_id: input.trip_id,
    preferred_date: input.preferred_date || null,
    num_people: input.num_people,
    quoted_price: quotedPrice,
    price_snapshot: useOverride
      ? {
          ...computed,
          price_override: true,
          computed_total: computed.total,
          ...(input.price_override_reason ? { price_override_reason: input.price_override_reason } : {}),
          total: quotedPrice,
        }
      : computed,
    notes: input.notes || null,
    status: 'new',
    context: 'standalone',
    source: input.source,
    selected_options: {},
  }
}
