import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Admin client (server-side only). Pass the acting staff session on admin
 * writes: its actor is sent as `x-weemap-actor`, which the database records in
 * status_history, audit_log, payment_records and domain events (migration 035
 * trusts that header only on service-role requests, i.e. from this server).
 */
export const getSupabaseAdmin = (acting?: { actor: string } | null) => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase server configuration is unavailable')
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    ...(acting?.actor ? { global: { headers: { 'x-weemap-actor': acting.actor } } } : {}),
  })
}
