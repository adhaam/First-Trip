import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone } from './phone'

/**
 * Client-injectable core of the unified customer resolver. Deliberately has
 * NO 'server-only' import so the matching rules can be unit tested against a
 * fake client (see customer.test.ts). Route handlers must NOT call this
 * directly — use findOrCreateCustomerByPhone from '@/lib/customer', which
 * binds it to the service-role client.
 */

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

/** See findOrCreateCustomerByPhone in src/lib/customer.ts for the contract. */
export async function findOrCreateCustomerWithClient(
  supabase: SupabaseClient,
  input: FindOrCreateCustomerInput,
): Promise<Customer> {
  const normalized = normalizePhone(input.phone)

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
