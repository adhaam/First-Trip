/**
 * Public standalone Sinai Trip / Trip Package request: the validated input
 * shape and the mapping to a `trip_bookings` row. Pure (no server imports) so
 * tests can prove a client-supplied payment_kind (or any other
 * payment-policy field) never reaches the inserted row — see
 * supabase/migrations/030_payment_policies.sql and src/lib/payment-rules.ts.
 *
 * Moved out of src/app/api/trip-bookings/route.ts unchanged (behaviour-identical
 * extraction) so it is unit-testable without a server-only import chain.
 */
import { z } from 'zod'
import type { TripPackage } from '@/lib/types'
import type { TripDiscountInput } from '@/lib/pricing'
import { buildTripPriceSnapshot, effectiveTripPrice } from '@/lib/pricing'

export const tripBookingSchema = z.object({
  trip_id: z.string().uuid().optional(),
  trip_package_id: z.string().uuid().optional(),
  customer_name: z.string().min(3).max(100),
  customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  num_people: z.number().int().min(1).max(50),
  adults: z.number().int().min(0).max(50).optional(),
  children: z.number().int().min(0).max(50).optional(),
  selected_options: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z.string().max(500).optional(),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
}).refine((d) => Boolean(d.trip_id) !== Boolean(d.trip_package_id), {
  message: 'Provide exactly one of trip_id or trip_package_id',
})

export type TripBookingInput = z.infer<typeof tripBookingSchema>

/** Either branch of the public trip-booking request, resolved server-side. */
export type ResolvedPublicTripBooking =
  | { kind: 'package'; pkg: TripPackage }
  | { kind: 'standalone'; trip: TripDiscountInput }

/**
 * Maps validated public trip-booking input to the `trip_bookings` insert row.
 * The quoted price is always server-derived from `resolved` — never trusted
 * from the client — and the row never carries a `payment_kind` (or any other
 * payment-policy field): that column is left for the DB's
 * weemap_set_payment_kind BEFORE INSERT trigger to derive.
 */
export function buildPublicTripBookingRow(
  data: TripBookingInput,
  resolved: ResolvedPublicTripBooking,
): Record<string, unknown> {
  const insertBase = {
    customer_name: data.customer_name,
    customer_phone: data.customer_phone,
    preferred_date: data.preferred_date || null,
    num_people: data.num_people,
    adults: data.adults ?? null,
    children: data.children ?? null,
    selected_options: data.selected_options || {},
    notes: data.notes || '',
    source: 'website',
    status: 'new',
  }

  if (resolved.kind === 'package') {
    // Package booking — server recomputes the authoritative total from
    // trusted DB values and freezes it into package_snapshot at request
    // time. Never trust a client-sent total.
    const pkg = resolved.pkg
    const quotedPrice = (pkg.totals?.packageTotal ?? 0) * data.num_people
    return {
      ...insertBase,
      trip_id: null,
      trip_package_id: pkg.id,
      context: 'package',
      quoted_price: quotedPrice,
      package_snapshot: {
        name_ar: pkg.name_ar,
        name_en: pkg.name_en,
        package_total: pkg.totals?.packageTotal,
        public_total: pkg.totals?.publicTotal,
        savings: pkg.totals?.savings,
        trips: (pkg.trips || []).map((t) => ({
          id: t.id,
          name_ar: t.name_ar,
          name_en: t.name_en,
          price: t.price,
          package_price: t.package_price,
        })),
      },
    }
  }

  // Quoted price is always server-derived — never trusted from the client.
  // Any active discount is applied here and FROZEN into price_snapshot:
  // changing or ending the discount later must not move this booking's
  // price (same contract as buildPriceSnapshot in lib/pricing.ts).
  const priced = effectiveTripPrice(resolved.trip)
  const quotedPrice = priced.final * data.num_people
  return {
    ...insertBase,
    trip_id: data.trip_id,
    context: 'standalone',
    quoted_price: quotedPrice,
    price_snapshot: buildTripPriceSnapshot(priced, data.num_people),
  }
}
