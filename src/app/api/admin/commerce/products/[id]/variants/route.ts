import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const variantSchema = z.object({
  sku: z.string().optional(),
  option_value_ids: z.array(z.string().uuid()).optional().default([]),
  price_override: z.number().min(0).nullable().optional(),
  inventory_quantity: z.number().int().min(0).optional().default(0),
  is_active: z.boolean().optional().default(true),
  image_url: z.string().optional().default(''),
  sort_order: z.number().int().min(0).optional().default(0),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = variantSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_product_variants')
    .insert({ ...validated.data, product_id: id })
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to create variant' }, { status: 500 })
  return NextResponse.json({ variant: data }, { status: 201 })
}
