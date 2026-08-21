import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { getTripRouteSlug } from '@/lib/trips'

export type SearchResultType = 'accommodation' | 'trip' | 'merch' | 'rental'

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

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get('q') || '').trim()

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [], query: q })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ results: [], query: q })
  }

  // Strip characters that corrupt PostgREST .or() filters
  const safe = q.replace(/[,()]/g, ' ').trim()

  try {
    const supabase = getSupabaseAdmin()

    const [accRes, tripRes, prodRes] = await Promise.allSettled([
      supabase
        .from('accommodations')
        .select('id, name_ar, name_en, type, images, price_per_night, description_ar, description_en')
        .eq('is_active', true)
        .or(`name_ar.ilike.%${safe}%,name_en.ilike.%${safe}%,description_ar.ilike.%${safe}%,description_en.ilike.%${safe}%`)
        .order('sort_order', { ascending: true })
        .limit(MAX_RESULTS_PER_GROUP),

      supabase
        .from('sinai_trips')
        .select('id, name_ar, name_en, category_ar, category_en, images, price, duration, duration_en, description_ar, description_en')
        .eq('is_active', true)
        .or(`name_ar.ilike.%${safe}%,name_en.ilike.%${safe}%,category_ar.ilike.%${safe}%,category_en.ilike.%${safe}%,description_ar.ilike.%${safe}%,description_en.ilike.%${safe}%`)
        .order('sort_order', { ascending: true })
        .limit(MAX_RESULTS_PER_GROUP),

      supabase
        .from('commerce_products')
        .select('id, slug, name_ar, name_en, type, images, description_ar, description_en')
        .eq('is_archived', false)
        .or(`name_ar.ilike.%${safe}%,name_en.ilike.%${safe}%,description_ar.ilike.%${safe}%,description_en.ilike.%${safe}%`)
        .order('sort_order', { ascending: true })
        .limit(MAX_RESULTS_PER_GROUP * 2),
    ])

    const results: SearchResult[] = []

    // Accommodations
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

    // Sinai Trips
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
          price: trip.price || undefined,
        })
      }
    }

    // Commerce products (split merch/rental)
    if (prodRes.status === 'fulfilled' && prodRes.value.data) {
      for (const prod of prodRes.value.data) {
        const image = Array.isArray(prod.images) && prod.images.length > 0 ? prod.images[0] : undefined
        const isMerch = prod.type === 'sale'
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

    return NextResponse.json({ results, query: q } satisfies SearchResponse)
  } catch (err) {
    console.error('Search API error:', err)
    return NextResponse.json({ results: [], query: q })
  }
}
