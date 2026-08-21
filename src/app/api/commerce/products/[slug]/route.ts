import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'

/**
 * Public product detail feed — everything the storefront configurator needs
 * for one product: variants, options/values, rental pricing tiers, and the
 * collections it belongs to. Only active, non-archived products resolve;
 * RLS already enforces this for anon reads on every joined table.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = getSupabaseAdmin()

  const { data: product, error } = await supabase
    .from('commerce_products')
    .select(`
      *,
      commerce_categories(name_ar, name_en, slug),
      commerce_product_variants(*),
      rental_pricing_tiers(*),
      commerce_product_options(*, commerce_product_option_values(*)),
      commerce_product_collections(collection_id)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .is('archived_at', null)
    .maybeSingle()

  if (error || !product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })

  const variants = (product.commerce_product_variants || []).filter((v: { is_active: boolean }) => v.is_active)
  const totalInventory = variants.length
    ? variants.reduce((sum: number, v: { inventory_quantity: number }) => sum + Number(v.inventory_quantity), 0)
    : 0

  return NextResponse.json({
    product: {
      ...product,
      commerce_product_variants: variants,
      rental_pricing_tiers: (product.rental_pricing_tiers || []).filter((t: { is_active: boolean }) => t.is_active),
      collection_ids: (product.commerce_product_collections || []).map((c: { collection_id: string }) => c.collection_id),
      total_inventory: totalInventory,
    },
  })
}
