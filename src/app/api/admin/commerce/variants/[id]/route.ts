import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  sku: z.string().optional(),
  option_value_ids: z.array(z.string().uuid()).optional(),
  price_override: z.number().min(0).nullable().optional(),
  inventory_quantity: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  image_url: z.string().optional(),
  sort_order: z.number().int().min(0).optional(),
})

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
    .from('commerce_product_variants')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update variant' }, { status: 500 })
  return NextResponse.json({ variant: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  // Variants referenced by historical order_items are protected (ON DELETE
  // SET NULL there), but we still prefer deactivating over deleting.
  const { error } = await supabase.from('commerce_product_variants').update({ is_active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: 'Failed to deactivate variant' }, { status: 500 })
  return NextResponse.json({ success: true })
}
