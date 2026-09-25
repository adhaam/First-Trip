import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Columns safe to return to the dashboard — password_hash never leaves the server. */
export const STAFF_COLUMNS = 'id, email, display_name, role, is_active, last_login_at, created_at, updated_at'

/**
 * Maps actor values recorded by the database ('staff:<uuid>' | 'legacy-admin' |
 * null) to display names for history and audit views.
 */
export async function resolveActorNames(
  supabase: SupabaseClient,
  actors: (string | null | undefined)[],
): Promise<Record<string, string>> {
  const ids = [...new Set(actors.filter((a): a is string => !!a && a.startsWith('staff:')).map((a) => a.slice(6)))]
  const names: Record<string, string> = { 'legacy-admin': 'Shared admin (legacy)' }
  if (ids.length === 0) return names
  const { data } = await supabase.from('staff_users').select('id, display_name').in('id', ids)
  for (const row of data ?? []) names[`staff:${row.id}`] = row.display_name
  return names
}
