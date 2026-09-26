// ─── site_pages — owner-controlled landing-page source of truth ───
// Migration 047. NULL on any column means "use the designed i18n copy /
// static fallback image" — never render an empty string. Read publicly by
// every landing page's server component through getSitePage(); written only
// by src/app/api/admin/site-pages/route.ts (service role, via
// src/components/admin/website/WebsiteManager.tsx).
//
// Pure types/helpers live in site-pages-core.ts (no server-only import) so
// they can be unit-tested directly — see site-pages.test.ts.

import 'server-only'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase'
import type { PageKey, SitePage } from './site-pages-core'

export {
  PAGE_KEYS,
  PAGE_FIELDS,
  isPageKey,
  pickCopy,
  pickHeroImage,
  type PageKey,
  type SitePage,
} from './site-pages-core'

/**
 * Reads one page's owner-controlled row. Tolerates the table or the row not
 * existing yet (migration 047 not applied, or a page_key seeded after this
 * code shipped) — every caller must treat `null` exactly like "no overrides,
 * use the designed defaults", never as an error.
 */
export async function getSitePage(key: PageKey): Promise<SitePage | null> {
  if (!isSupabaseConfigured()) return null
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('site_pages')
    .select('*')
    .eq('page_key', key)
    .maybeSingle()

  if (error) {
    // 42P01 = relation does not exist (migration 047 not applied yet).
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
      return null
    }
    console.error('getSitePage error:', error)
    return null
  }
  return (data as SitePage) ?? null
}

/** All rows, for the Website admin's Pages tab. Same missing-table tolerance as getSitePage. */
export async function getAllSitePages(): Promise<SitePage[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('site_pages').select('*').order('page_key', { ascending: true })
  if (error) {
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) return []
    console.error('getAllSitePages error:', error)
    return []
  }
  return (data ?? []) as SitePage[]
}
