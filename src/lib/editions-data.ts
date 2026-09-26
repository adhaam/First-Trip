// ─── WEEMAP Editions — server-side fetches ───
// Mirrors src/lib/trip-packages.ts / src/lib/experiences.ts: always the
// service-role client (RLS is bypassed), so the real privacy boundary is
// this explicit PUBLIC_EDITION_COLUMNS list, never `select('*')`. No
// internal column (partner_id, min_group_size, cost_*, contingency_pct,
// created_at, updated_at) is ever named below.

import type { PublicEdition } from '@/lib/editions'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'

const PUBLIC_EDITION_COLUMNS = [
  'id', 'slug', 'title_en', 'title_ar',
  'short_description_en', 'short_description_ar',
  'full_description_en', 'full_description_ar',
  'category', 'status', 'featured', 'published', 'sort_order', 'hero_image_url',
  'start_date', 'end_date', 'location_en', 'location_ar',
  'price_per_person_egp', 'payment_mode', 'deposit_value', 'balance_due_days_before_start',
  'max_group_size', 'level_en', 'level_ar', 'who_for_en', 'who_for_ar',
  'stay_en', 'stay_ar', 'good_to_know_en', 'good_to_know_ar',
  'includes', 'excludes', 'program',
  'partner_name', 'partner_logo_url', 'partner_role_en', 'partner_role_ar', 'partner_url',
].join(', ')

/** Published, non-HIDDEN Editions, sorted for the landing page grid. */
export async function listPublicEditions(): Promise<PublicEdition[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('editions')
    .select(PUBLIC_EDITION_COLUMNS)
    .eq('published', true)
    .neq('status', 'HIDDEN')
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('listPublicEditions error:', error)
    return []
  }
  return (data || []) as unknown as PublicEdition[]
}

/** One published, non-HIDDEN Edition by slug — for the detail page. Null if not found or not publicly visible. */
export async function getPublicEditionBySlug(slug: string): Promise<PublicEdition | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('editions')
    .select(PUBLIC_EDITION_COLUMNS)
    .eq('slug', slug)
    .eq('published', true)
    .neq('status', 'HIDDEN')
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as PublicEdition
}

/**
 * Confirms an Edition exists and is publicly visible — used by
 * POST /api/edition-requests to validate edition_id server-side before
 * writing edition_slug/edition_title_snapshot. Only the columns needed for
 * that snapshot are selected.
 */
export async function getPublicEditionForRequest(
  editionId: string,
): Promise<Pick<PublicEdition, 'id' | 'slug' | 'title_en' | 'title_ar'> | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('editions')
    .select('id, slug, title_en, title_ar')
    .eq('id', editionId)
    .eq('published', true)
    .neq('status', 'HIDDEN')
    .maybeSingle()
  if (error || !data) return null
  return data as unknown as Pick<PublicEdition, 'id' | 'slug' | 'title_en' | 'title_ar'>
}
