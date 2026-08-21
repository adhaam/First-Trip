import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const updateSchema = z.object({
  status: z.enum(['new', 'contacted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']).optional(),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  internal_notes: z.string().max(2000).optional(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('*, customers(id, name, phone, whatsapp_phone, normalized_phone), commerce_order_items(*), delivery_zones(name_ar, name_en)')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ order: data })
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

  // Sale inventory is reserved (decremented) at order-creation time — see
  // src/lib/orders.ts. Cancelling an order that hasn't already been
  // cancelled must give that stock back, exactly once.
  if (validated.data.status === 'cancelled') {
    const { data: current } = await supabase.from('commerce_orders').select('status').eq('id', id).single()
    if (current && current.status !== 'cancelled') {
      const { data: items } = await supabase
        .from('commerce_order_items')
        .select('variant_id, quantity, item_type')
        .eq('order_id', id)
      for (const item of items || []) {
        if (item.item_type === 'sale' && item.variant_id) {
          await supabase.rpc('restock_variant_inventory', { p_variant_id: item.variant_id, p_qty: item.quantity })
        }
      }
    }
  }

  const { data, error } = await supabase
    .from('commerce_orders')
    .update(validated.data)
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: 'Failed to update order' }, { status: 500 })
  return NextResponse.json({ order: data })
}
