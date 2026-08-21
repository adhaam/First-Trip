import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/** Public read of active collections, optionally with their active product ids. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const withProducts = searchParams.get('with_products') === '1'
  const supabase = getSupabaseAdmin()

  const { data: collections, error } = await supabase
    .from('commerce_collections')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) return NextResponse.json({ error: 'Failed to load collections' }, { status: 500 })

  if (!withProducts || !collections?.length) return NextResponse.json({ collections: collections || [] })

  const { data: links } = await supabase
    .from('commerce_product_collections')
    .select('collection_id, product_id, commerce_products!inner(slug, is_active, archived_at)')
    .in('collection_id', collections.map((c) => c.id))

  const byCollection = new Map<string, string[]>()
  for (const l of links || []) {
    const p = l.commerce_products as unknown as { slug: string; is_active: boolean; archived_at: string | null }
    if (!p.is_active || p.archived_at) continue
    const list = byCollection.get(l.collection_id) || []
    list.push(l.product_id)
    byCollection.set(l.collection_id, list)
  }

  return NextResponse.json({
    collections: collections.map((c) => ({ ...c, product_ids: byCollection.get(c.id) || [] })),
  })
}
