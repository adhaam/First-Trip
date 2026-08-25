import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  product_type: z.enum(['sale', 'rental']).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  images: z.array(z.string()).optional(),
  base_price: z.number().min(0).optional(),
  compare_at_price: z.number().min(0).nullable().optional(),
  badge_text: z.string().max(40).optional(),
  sku: z.string().optional(),
  track_inventory: z.boolean().optional(),
  requires_delivery: z.boolean().optional(),
  pickup_enabled: z.boolean().optional(),
  delivery_enabled: z.boolean().optional(),
  deposit_amount: z.number().min(0).optional(),
  rental_requirements: z.array(z.string().max(60)).optional(),
  pickup_instructions_ar: z.string().max(1000).optional(),
  pickup_instructions_en: z.string().max(1000).optional(),
  is_active: z.boolean().optional(),
  is_featured: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
  seo_title: z.string().max(200).optional(),
  seo_description_ar: z.string().max(400).optional(),
  seo_description_en: z.string().max(400).optional(),
  discount_value: z.number().min(0).nullable().optional(),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional(),
  discount_label: z.string().max(100).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const [{ data: product }, { data: variants }, { data: options }, { data: tiers }, { data: collectionLinks }] = await Promise.all([
    supabase.from('commerce_products').select('*').eq('id', id).single(),
    supabase.from('commerce_product_variants').select('*').eq('product_id', id).order('sort_order'),
    supabase.from('commerce_product_options').select('*, commerce_product_option_values(*)').eq('product_id', id).order('sort_order'),
    supabase.from('rental_pricing_tiers').select('*').eq('product_id', id).order('duration_days'),
    supabase.from('commerce_product_collections').select('collection_id').eq('product_id', id),
  ])
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 })
  return NextResponse.json({
    product,
    variants: variants || [],
    options: options || [],
    rentalTiers: tiers || [],
    collectionIds: (collectionLinks || []).map((c) => c.collection_id),
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_products')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  return NextResponse.json({ product: data })
}

// Soft delete / archive — historical order_items keep their product_id
// (ON DELETE SET NULL) but we never hard-delete a product with orders.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('commerce_products')
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to archive product' }, { status: 500 })
  return NextResponse.json({ success: true })
}
