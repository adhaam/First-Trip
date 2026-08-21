import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/phone'

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

export interface Customer {
  id: string
  name: string
  phone: string
  normalized_phone: string | null
  email: string | null
  whatsapp_phone: string | null
  preferred_language: 'ar' | 'en'
  total_bookings: number
  last_booking_at: string | null
  last_activity_at: string | null
  created_at: string
  merged_into: string | null
}

export interface FindOrCreateCustomerInput {
  phone: string
  name?: string
  email?: string | null
  whatsappPhone?: string | null
  preferredLanguage?: 'ar' | 'en'
  touchActivity?: boolean
}

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
  const normalized = normalizePhone(input.phone)
  const supabase = getSupabaseAdmin()

  if (!normalized) {
    // Can't confidently normalize — still create/find a record keyed on the
    // raw phone so the customer isn't silently dropped, but don't set
    // normalized_phone (avoids false-positive matches later).
    const { data: existingRaw } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', input.phone)
      .is('normalized_phone', null)
      .maybeSingle()

    if (existingRaw) return existingRaw as Customer

    const { data: created, error } = await supabase
      .from('customers')
      .insert({
        name: input.name || input.phone,
        phone: input.phone,
        raw_phone: input.phone,
        email: input.email || null,
        whatsapp_phone: input.whatsappPhone || null,
        preferred_language: input.preferredLanguage || 'ar',
        last_activity_at: new Date().toISOString(),
      })
      .select('*')
      .single()
    if (error) throw error
    return created as Customer
  }

  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('normalized_phone', normalized)
    .is('merged_into', null)
    .maybeSingle()

  if (existing) {
    const updates: Record<string, unknown> = {}
    if (input.touchActivity !== false) updates.last_activity_at = new Date().toISOString()
    // Fill in gaps opportunistically without overwriting existing data.
    if (input.email && !existing.email) updates.email = input.email
    if (input.whatsappPhone && !existing.whatsapp_phone) updates.whatsapp_phone = input.whatsappPhone
    if (input.name && (!existing.name || existing.name === existing.phone)) updates.name = input.name

    if (Object.keys(updates).length > 0) {
      const { data: updated } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', existing.id)
        .select('*')
        .single()
      if (updated) return updated as Customer
    }
    return existing as Customer
  }

  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      name: input.name || input.phone,
      phone: input.phone,
      raw_phone: input.phone,
      normalized_phone: normalized,
      email: input.email || null,
      whatsapp_phone: input.whatsappPhone || null,
      preferred_language: input.preferredLanguage || 'ar',
      last_activity_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    // Race condition: another request created the same normalized_phone
    // between our SELECT and INSERT. The partial unique index rejects the
    // insert — re-fetch and return the winner instead of failing the request.
    const { data: raceWinner } = await supabase
      .from('customers')
      .select('*')
      .eq('normalized_phone', normalized)
      .is('merged_into', null)
      .maybeSingle()
    if (raceWinner) return raceWinner as Customer
    throw error
  }

  return created as Customer
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
