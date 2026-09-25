import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'
import {
  findOrCreateCustomerWithClient,
  type Customer,
  type FindOrCreateCustomerInput,
} from '@/lib/customer-resolution'

/**
 * WEEMAP unified customer identity.
 *
 * The phone number is the customer's identity matching key, NOT the database
 * primary key. `id` (UUID) remains the relational primary key used by every
 * foreign key across accommodation bookings, Sinai Trip bookings, and
 * commerce orders.
 *
 * normalizePhone() itself lives in src/lib/phone.ts (no server-only/Supabase
 * import there) so it can be unit tested directly — re-exported here for
 * backward-compatible imports.
 */
export { normalizePhone }
export type { Customer, FindOrCreateCustomerInput }

/**
 * The single reusable entry point every booking/order/request flow across
 * WEEMAP (accommodation bookings, Sinai Trip bookings, merch orders, rental
 * requests) MUST use to resolve customer identity. Never insert/upsert into
 * `customers` directly from a route handler.
 *
 * - Normalizes the phone number.
 * - Matches an existing customer by normalized_phone.
 * - Follows `merged_into` to the canonical customer if the match was a
 *   superseded duplicate.
 * - Creates a new customer row when no match exists.
 * - Optionally bumps `last_activity_at` (does NOT touch total_bookings /
 *   last_booking_at — that stays booking-specific and is updated by the
 *   caller once the booking/order actually exists).
 *
 * Returns the canonical customer UUID — the value every other table should
 * store as `customer_id`.
 */
export async function findOrCreateCustomerByPhone(
  input: FindOrCreateCustomerInput,
): Promise<Customer> {
  // Logic lives in customer-resolution.ts (no server-only import) so it can
  // be exercised against a fake client in tests; behaviour is unchanged.
  return findOrCreateCustomerWithClient(getSupabaseAdmin(), input)
}

/** Resolves a (possibly merged/superseded) customer id to its canonical id. */
export async function resolveCanonicalCustomerId(customerId: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('customers')
    .select('id, merged_into')
    .eq('id', customerId)
    .maybeSingle()
  if (!data) return customerId
  return data.merged_into || data.id
}

/**
 * Bumps total_bookings / last_booking_at for a customer after a booking,
 * trip booking, or order is actually created. Kept separate from
 * findOrCreateCustomerByPhone so a lookup with no resulting booking never
 * inflates the counter.
 */
export async function recordCustomerActivity(customerId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const canonicalId = await resolveCanonicalCustomerId(customerId)
  const { data: current } = await supabase
    .from('customers')
    .select('total_bookings')
    .eq('id', canonicalId)
    .maybeSingle()
  await supabase
    .from('customers')
    .update({
      total_bookings: (current?.total_bookings || 0) + 1,
      last_booking_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', canonicalId)
}
