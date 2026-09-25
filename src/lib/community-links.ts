import type { CommunityLinkedTarget, CommunityLinkTargetType, CommunityPostLink } from './types'
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase'
import { getTripRouteSlug } from './trips'

// ─── Community discovery links (migration 037) — server-only loaders ───
//
// A community post can be curated to link real stays/trips/packages/
// Signature experiences it is about. Never inferred automatically — every
// row here was added by an operator through the admin API, which validates
// the target exists and is public before writing the link (see
// src/app/api/admin/community-posts/[id]/links/route.ts).
//
// This module touches Supabase (server-only, via `server-only` transitively
// through ./supabase) and must NOT be imported from src/lib/community.ts or
// src/lib/community-view.ts — both are imported from client-safe contexts.

/** Target table + the column/value that makes a row publicly visible, per target type. */
const TARGET_CONFIG: Record<CommunityLinkTargetType, {
  table: string
  activeColumn: string
  activeValue: unknown
  titleAr: string
  titleEn: string
  imageExpr: (row: Record<string, unknown>) => string | null
  pathname: (row: Record<string, unknown>) => string
}> = {
  stay: {
    table: 'accommodations',
    activeColumn: 'is_active',
    activeValue: true,
    titleAr: 'name_ar',
    titleEn: 'name_en',
    imageExpr: (row) => (Array.isArray(row.images) && row.images.length > 0 ? (row.images[0] as string) : null),
    pathname: (row) => `/book-dahab/${row.id}`,
  },
  trip: {
    table: 'sinai_trips',
    activeColumn: 'is_active',
    activeValue: true,
    titleAr: 'name_ar',
    titleEn: 'name_en',
    imageExpr: (row) => (Array.isArray(row.images) && row.images.length > 0 ? (row.images[0] as string) : null),
    pathname: (row) => `/sinai-trips/${getTripRouteSlug({ id: row.id as string, name_en: (row.name_en as string) || '' })}`,
  },
  trip_package: {
    table: 'trip_packages',
    activeColumn: 'is_active',
    activeValue: true,
    titleAr: 'name_ar',
    titleEn: 'name_en',
    imageExpr: (row) => (row.image as string) || null,
    pathname: (row) => `/sinai-trips/packages/${row.slug}`,
  },
  signature_experience: {
    table: 'experiences',
    activeColumn: 'status',
    activeValue: 'published',
    titleAr: 'title_ar',
    titleEn: 'title_en',
    imageExpr: (row) => (Array.isArray(row.images) && row.images.length > 0 ? (row.images[0] as string) : null),
    pathname: (row) => `/signature/${row.slug}`,
  },
}

/** True only if the target row exists AND is public (active/published) — checked server-side before an admin can save a link. */
export async function communityLinkTargetExists(targetType: CommunityLinkTargetType, targetId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const config = TARGET_CONFIG[targetType]
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from(config.table)
    .select('id')
    .eq('id', targetId)
    .eq(config.activeColumn, config.activeValue)
    .maybeSingle()
  if (error) {
    console.error('communityLinkTargetExists error:', error)
    return false
  }
  return Boolean(data)
}

/** Every link row for a post, in display order — admin editor list (raw rows, no target join). */
export async function getCommunityPostLinks(postId: string): Promise<CommunityPostLink[]> {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('community_post_links')
    .select('*')
    .eq('post_id', postId)
    .order('sort_order', { ascending: true })
  if (error) {
    console.error('getCommunityPostLinks error:', error)
    return []
  }
  return (data ?? []) as CommunityPostLink[]
}

/**
 * A post's links resolved against their live target rows — what the public
 * "Plan it with WEEMAP" block renders. A link whose target no longer
 * exists or is no longer public is silently dropped (never a dead link).
 */
export async function getLinkedTargetsForPost(postId: string): Promise<CommunityLinkedTarget[]> {
  if (!isSupabaseConfigured()) return []
  const links = await getCommunityPostLinks(postId)
  if (links.length === 0) return []
  return resolveLinkedTargets(links)
}

async function resolveLinkedTargets(links: CommunityPostLink[]): Promise<CommunityLinkedTarget[]> {
  const supabase = getSupabaseAdmin()
  const byType = new Map<CommunityLinkTargetType, string[]>()
  for (const link of links) {
    const ids = byType.get(link.target_type) ?? []
    ids.push(link.target_id)
    byType.set(link.target_type, ids)
  }

  const rowsByTypeAndId = new Map<string, Record<string, unknown>>()
  await Promise.all(
    Array.from(byType.entries()).map(async ([targetType, ids]) => {
      const config = TARGET_CONFIG[targetType]
      const { data, error } = await supabase
        .from(config.table)
        .select('*')
        .in('id', ids)
        .eq(config.activeColumn, config.activeValue)
      if (error) {
        console.error('resolveLinkedTargets error:', error)
        return
      }
      for (const row of (data ?? []) as Record<string, unknown>[]) {
        rowsByTypeAndId.set(`${targetType}:${row.id}`, row)
      }
    })
  )

  const resolved: CommunityLinkedTarget[] = []
  for (const link of links) {
    const row = rowsByTypeAndId.get(`${link.target_type}:${link.target_id}`)
    if (!row) continue // target deleted / deactivated since the link was made
    const config = TARGET_CONFIG[link.target_type]
    resolved.push({
      id: link.id,
      target_type: link.target_type,
      target_id: link.target_id,
      title_ar: (row[config.titleAr] as string) || '',
      title_en: (row[config.titleEn] as string) || '',
      image: config.imageExpr(row),
      pathname: config.pathname(row),
    })
  }
  return resolved
}

/**
 * Reverse lookup for a detail page's "Local guides" block: published
 * community posts that explicitly link to this target. Never automatic —
 * only rows an operator curated in community_post_links.
 */
export async function getCommunityPostsLinkingTarget(
  targetType: CommunityLinkTargetType,
  targetId: string,
  limit = 3
) {
  if (!isSupabaseConfigured()) return []
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('community_post_links')
    .select('sort_order, community_posts!inner(id, slug, title_ar, title_en, image_url, category, is_published)')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('community_posts.is_published', true)
    .order('sort_order', { ascending: true })
    .limit(limit)
  if (error) {
    console.error('getCommunityPostsLinkingTarget error:', error)
    return []
  }
  type Row = { community_posts: { id: string; slug: string | null; title_ar: string; title_en: string; image_url: string | null; category: string } }
  return ((data ?? []) as unknown as Row[])
    .map((row) => row.community_posts)
    .filter((post) => post.slug)
}
