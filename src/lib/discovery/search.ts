import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getTripRouteSlug } from '@/lib/trips'
import { effectiveTripPrice } from '@/lib/pricing'
import { searchTokens } from './search-normalize'

export type SearchResultType = 'accommodation' | 'trip' | 'trip_package' | 'merch' | 'rental' | 'community_post'

export interface SearchResult {
  type: SearchResultType
  id: string
  title_ar: string
  title_en: string
  description_ar?: string
  description_en?: string
  image?: string
  url: string
  category_ar?: string
  category_en?: string
  price?: number
}

export interface SearchResponse {
  results: SearchResult[]
  query: string
}

const MAX_RESULTS_PER_GROUP = 5

/** Values interpolated into PostgREST's `.or()` grammar must not contain
 * grammar tokens or LIKE wildcards. */
export function sanitizeSearchFilter(value: string): string {
  return value.replace(/[%_*,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

type DocType = 'accommodation' | 'trip' | 'trip_package' | 'product' | 'community_post'

/**
 * Ids of public documents containing EVERY query token, per type, in
 * catalogue order. Matching runs on the normalised view from migration 038,
 * so Arabic spelling variants (hamza, taa marbuta, alef maqsura, diacritics)
 * and split/joined words ("بلو هول" vs "البلوهول") still meet.
 */
async function matchingIds(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  tokens: string[],
): Promise<Record<DocType, string[]>> {
  let query = supabase
    .from('public_search_documents')
    .select('doc_type, id')
    .order('sort_order', { ascending: true })
    .limit(200)
  for (const token of tokens) query = query.ilike('search_text', `%${token}%`)
  const { data, error } = await query
  if (error) throw error
  const ids: Record<DocType, string[]> = {
    accommodation: [], trip: [], trip_package: [], product: [], community_post: [],
  }
  for (const row of (data ?? []) as { doc_type: DocType; id: string }[]) {
    const bucket = ids[row.doc_type]
    const cap = row.doc_type === 'product' ? MAX_RESULTS_PER_GROUP * 2 : MAX_RESULTS_PER_GROUP
    if (bucket && bucket.length < cap) bucket.push(row.id)
  }
  return ids
}

/**
 * The one place public search runs — used by /api/search (the header's
 * GlobalSearch overlay) AND the /[locale]/search results page, so both
 * surfaces search the exact same public catalog with the exact same
 * active/published filters. Never returns inactive, draft, or
 * admin/customer/booking data: the view only contains public rows, and the
 * detail loads below repeat the visibility filters.
 */
export async function runSearch(rawQuery: string): Promise<SearchResponse> {
  const q = rawQuery.trim()

  if (!q || q.length < 2 || !isSupabaseConfigured()) {
    return { results: [], query: q }
  }

  const safe = sanitizeSearchFilter(q)
  const tokens = safe ? searchTokens(safe) : []
  if (!tokens.length) return { results: [], query: q }

  try {
    const supabase = getSupabaseAdmin()
    const ids = await matchingIds(supabase, tokens)
    const none = Promise.resolve({ data: [] as never[], error: null })
    const inOrder = <T extends { id: string }>(rows: T[] | null, order: string[]) =>
      [...(rows ?? [])].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))

    const [accRes, tripRes, packageRes, prodRes, postRes] = await Promise.allSettled([
      ids.accommodation.length
        ? supabase
          .from('accommodations')
          .select('id, name_ar, name_en, type, images, price_per_night, description_ar, description_en')
          .eq('is_active', true)
          .in('id', ids.accommodation)
        : none,

      ids.trip.length
        ? supabase
          .from('sinai_trips')
          // One literal so supabase-js can type the row.
          .select('id, name_ar, name_en, category_ar, category_en, images, price, discount_type, discount_value, discount_starts_at, discount_ends_at, duration, duration_en, description_ar, description_en')
          .eq('is_active', true)
          .in('id', ids.trip)
        : none,

      ids.trip_package.length
        ? supabase
          .from('trip_packages')
          .select('id, slug, name_ar, name_en, short_description_ar, short_description_en, image')
          .eq('is_active', true)
          .in('id', ids.trip_package)
        : none,

      ids.product.length
        ? supabase
          .from('commerce_products')
          .select('id, slug, name_ar, name_en, product_type, images, description_ar, description_en')
          .eq('is_active', true)
          .is('archived_at', null)
          .in('id', ids.product)
        : none,

      // Community guides — published only. Never a draft, never an
      // admin/internal field.
      ids.community_post.length
        ? supabase
          .from('community_posts')
          .select('id, slug, title_ar, title_en, content_ar, content_en, category, image_url')
          .eq('is_published', true)
          .in('id', ids.community_post)
        : none,
    ])

    if (accRes.status === 'fulfilled') accRes.value.data = inOrder(accRes.value.data, ids.accommodation)
    if (tripRes.status === 'fulfilled') tripRes.value.data = inOrder(tripRes.value.data, ids.trip)
    if (packageRes.status === 'fulfilled') packageRes.value.data = inOrder(packageRes.value.data, ids.trip_package)
    if (prodRes.status === 'fulfilled') prodRes.value.data = inOrder(prodRes.value.data, ids.product)
    if (postRes.status === 'fulfilled') postRes.value.data = inOrder(postRes.value.data, ids.community_post)

    const results: SearchResult[] = []

    if (accRes.status === 'fulfilled' && accRes.value.data) {
      for (const acc of accRes.value.data) {
        const image = Array.isArray(acc.images) && acc.images.length > 0 ? acc.images[0] : undefined
        results.push({
          type: 'accommodation',
          id: acc.id,
          title_ar: acc.name_ar || '',
          title_en: acc.name_en || '',
          description_ar: acc.description_ar?.slice(0, 100) || undefined,
          description_en: acc.description_en?.slice(0, 100) || undefined,
          image,
          url: `/book-dahab/${acc.id}`,
          category_ar: acc.type === 'hotel' ? 'فندق' : acc.type === 'chalet' ? 'شاليه' : 'كامب',
          category_en: acc.type === 'hotel' ? 'Hotel' : acc.type === 'chalet' ? 'Chalet' : 'Camp',
          price: acc.price_per_night || undefined,
        })
      }
    }

    if (tripRes.status === 'fulfilled' && tripRes.value.data) {
      for (const trip of tripRes.value.data) {
        const image = Array.isArray(trip.images) && trip.images.length > 0 ? trip.images[0] : undefined
        const slug = getTripRouteSlug({ id: trip.id, name_en: trip.name_en || '' })
        results.push({
          type: 'trip',
          id: trip.id,
          title_ar: trip.name_ar || '',
          title_en: trip.name_en || '',
          description_ar: trip.description_ar?.slice(0, 100) || undefined,
          description_en: trip.description_en?.slice(0, 100) || undefined,
          image,
          url: `/sinai-trips/${slug}`,
          category_ar: trip.category_ar || undefined,
          category_en: trip.category_en || undefined,
          price: effectiveTripPrice(trip).final || undefined,
        })
      }
    }

    if (packageRes.status === 'fulfilled' && packageRes.value.data) {
      for (const pkg of packageRes.value.data) {
        results.push({
          type: 'trip_package',
          id: pkg.id,
          title_ar: pkg.name_ar || '',
          title_en: pkg.name_en || '',
          description_ar: pkg.short_description_ar?.slice(0, 100) || undefined,
          description_en: pkg.short_description_en?.slice(0, 100) || undefined,
          image: pkg.image || undefined,
          url: `/sinai-trips/packages/${pkg.slug}`,
        })
      }
    }

    if (prodRes.status === 'fulfilled' && prodRes.value.data) {
      for (const prod of prodRes.value.data) {
        const image = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : undefined
        const isMerch = prod.product_type === 'sale'
        results.push({
          type: isMerch ? 'merch' : 'rental',
          id: prod.id,
          title_ar: prod.name_ar || '',
          title_en: prod.name_en || '',
          description_ar: prod.description_ar?.slice(0, 100) || undefined,
          description_en: prod.description_en?.slice(0, 100) || undefined,
          image,
          url: isMerch ? `/merch/${prod.slug}` : `/rent/${prod.slug}`,
        })
      }
    }

    if (postRes.status === 'fulfilled' && postRes.value.data) {
      for (const post of postRes.value.data) {
        if (!post.slug) continue // pre-slug rows never surface in search (no URL to send someone to)
        results.push({
          type: 'community_post',
          id: post.id,
          title_ar: post.title_ar || '',
          title_en: post.title_en || '',
          description_ar: post.content_ar?.slice(0, 100) || undefined,
          description_en: post.content_en?.slice(0, 100) || undefined,
          image: post.image_url || undefined,
          url: `/community/${post.slug}`,
          category_ar: post.category || undefined,
          category_en: post.category || undefined,
        })
      }
    }

    return { results, query: q }
  } catch (err) {
    console.error('Search error:', err)
    return { results: [], query: q }
  }
}
