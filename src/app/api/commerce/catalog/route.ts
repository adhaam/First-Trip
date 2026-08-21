import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Public read-only catalog feed for the (future) storefront UI. Returns
 * only active, non-archived categories/products — RLS already enforces
 * this at the DB level for anon reads, this route just shapes the payload.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productType = searchParams.get('type') // 'sale' | 'rental' | null

  const supabase = getSupabaseAdmin()

  const { data: categories } = await supabase
    .from('commerce_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  let productsQuery = supabase
    .from('commerce_products')
    .select('*, commerce_product_variants(*), rental_pricing_tiers(*)')
    .eq('is_active', true)
    .order('sort_order')

  if (productType === 'sale' || productType === 'rental') {
    productsQuery = productsQuery.eq('product_type', productType)
  }

  const { data: products, error } = await productsQuery
  if (error) return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 })

  return NextResponse.json({ categories: categories || [], products: products || [] })
}
