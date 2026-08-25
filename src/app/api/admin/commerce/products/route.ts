import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const productSchema = z.object({
  category_id: z.string().uuid().nullable().optional(),
  product_type: z.enum(['sale', 'rental']),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  base_price: z.number().min(0).optional().default(0),
  compare_at_price: z.number().min(0).nullable().optional(),
  badge_text: z.string().max(40).optional().default(''),
  sku: z.string().optional(),
  track_inventory: z.boolean().optional().default(true),
  requires_delivery: z.boolean().optional().default(true),
  pickup_enabled: z.boolean().optional().default(true),
  delivery_enabled: z.boolean().optional().default(true),
  deposit_amount: z.number().min(0).optional().default(0),
  rental_requirements: z.array(z.string().max(60)).optional().default([]),
  pickup_instructions_ar: z.string().max(1000).optional().default(''),
  pickup_instructions_en: z.string().max(1000).optional().default(''),
  is_active: z.boolean().optional().default(true),
  is_featured: z.boolean().optional().default(false),
  sort_order: z.number().int().min(0).optional().default(0),
  seo_title: z.string().max(200).optional(),
  seo_description_ar: z.string().max(400).optional(),
  seo_description_en: z.string().max(400).optional(),
  discount_value: z.number().min(0).nullable().optional().default(null),
  discount_type: z.enum(['amount', 'percentage']).nullable().optional().default(null),
  discount_label: z.string().max(100).optional().default(''),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const productType = searchParams.get('product_type')
  let query = supabase
    .from('commerce_products')
    .select('*, commerce_categories(name_ar, name_en, slug)')
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (productType === 'sale' || productType === 'rental') query = query.eq('product_type', productType)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })

  // Fetch total inventory for rental products
  const productsWithInventory = await Promise.all((data || []).map(async (p) => {
    if (p.product_type !== 'rental') return p
    const { data: variants } = await supabase
      .from('commerce_product_variants')
      .select('inventory_quantity')
      .eq('product_id', p.id)
    const total = (variants || []).reduce((sum, v) => sum + Number(v.inventory_quantity || 0), 0)
    return { ...p, total_inventory: total }
  }))

  return NextResponse.json({ products: productsWithInventory })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = productSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('commerce_products').insert(validated.data).select().single()
  if (error) {
    console.error('POST commerce_product error:', error)
    return NextResponse.json({ error: 'Failed to create product (slug may already exist)' }, { status: 500 })
  }
  return NextResponse.json({ product: data }, { status: 201 })
}
