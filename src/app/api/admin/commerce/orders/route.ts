import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createCommerceOrder } from '@/lib/orders'

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { searchParams } = new URL(req.url)
  const orderType = searchParams.get('order_type')
  let query = supabase
    .from('commerce_orders')
    .select('*, customers(name, phone), commerce_order_items(*)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (orderType === 'merch' || orderType === 'rental' || orderType === 'mixed') {
    query = query.eq('order_type', orderType)
  }
  const { data, error } = await query
  if (error) {
    console.error('GET commerce_orders error:', error)
    return NextResponse.json({ error: 'Failed to load orders' }, { status: 500 })
  }
  return NextResponse.json({ orders: data })
}

const manualOrderSchema = z.object({
  customer_name: z.string().min(2).max(100),
  customer_phone: z.string().min(6).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  fulfillment_method: z.enum(['pickup', 'delivery']),
  delivery_zone_id: z.string().uuid().optional(),
  delivery_address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  status: z.enum(['new', 'processing', 'ready', 'completed', 'cancelled']).optional(),
  payment_status: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  amount_paid: z.number().min(0).optional(),
  payment_channel: z.enum(['instapay', 'vodafonecash', 'cash', 'bank_transfer', 'other']).optional(),
  payment_received_by: z.string().max(200).optional(),
  discount_value: z.number().min(0).optional(),
  discount_type: z.enum(['amount', 'percentage']).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(50),
    rental_duration_days: z.number().int().min(1).optional(),
    rental_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).min(1).max(20),
})

/**
 * Manual order entry — for merch/rental sales Adham takes over the phone,
 * WhatsApp, or in person. Reuses createCommerceOrder() so pricing, inventory
 * decrementing, and rental availability checks are IDENTICAL to the public
 * checkout — nobody hand-types a total that could drift from real stock/price.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = manualOrderSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const input = validated.data

  const result = await createCommerceOrder({
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    customerEmail: input.customer_email || null,
    fulfillmentMethod: input.fulfillment_method,
    deliveryZoneId: input.delivery_zone_id || null,
    deliveryAddress: input.delivery_address || null,
    notes: input.notes,
    source: 'manual',
    status: input.status,
    discountValue: input.discount_value ?? null,
    discountType: input.discount_type ?? null,
    paymentStatus: input.payment_status,
    amountPaid: input.amount_paid,
    paymentChannel: input.payment_channel ?? null,
    paymentReceivedBy: input.payment_received_by ?? null,
    items: input.items.map((i) => ({
      productId: i.product_id,
      variantId: i.variant_id || null,
      quantity: i.quantity,
      rentalDurationDays: i.rental_duration_days,
      rentalStartDate: i.rental_start_date,
    })),
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: order } = await supabase
    .from('commerce_orders')
    .select('*, customers(name, phone), commerce_order_items(*)')
    .eq('id', result.orderId)
    .single()

  return NextResponse.json({ order }, { status: 201 })
}
