import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { applyCommerceOrderPatch } from '@/lib/orders'
import { STATUSES, WorkflowError, allowedNextStatuses, assertTransition } from '@/lib/request-workflow'

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
  if (validated.data.status) {
    const supabase = getSupabaseAdmin()
    const targetStatus = validated.data.status
    const { data: current, error: currentError } = await supabase
      .from('commerce_orders')
      .select('status')
      .eq('id', id)
      .maybeSingle()
    if (currentError) return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (!(STATUSES.commerce_order as readonly string[]).includes(targetStatus)) {
      return NextResponse.json({ error: 'Invalid order status' }, { status: 400 })
    }
    try {
      assertTransition('commerce_order', current.status as (typeof STATUSES.commerce_order)[number], targetStatus)
    } catch (error) {
      if (error instanceof WorkflowError) {
        return NextResponse.json(
          { code: 'invalid_transition', allowed: allowedNextStatuses('commerce_order', current.status as (typeof STATUSES.commerce_order)[number]) },
          { status: 409 },
        )
      }
      throw error
    }
    const result = await applyCommerceOrderPatch(id, {
      ...validated.data,
      expectedStatus: current.status as (typeof STATUSES.commerce_order)[number],
    })
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
          ...(result.pendingLineIds ? { pending_line_ids: result.pendingLineIds } : {}),
          ...(result.warnings?.length ? { warnings: result.warnings } : {}),
        },
        { status: result.status },
      )
    }
    return NextResponse.json({ order: result.order, warnings: result.warnings })
  }
  // Cancel/reopen restock + reservation handling is idempotent and symmetric
  // (conditional status writes guard against double restock) — see
  // applyOrderPatchWithClient in src/lib/order-core.ts.
  const result = await applyCommerceOrderPatch(id, validated.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ order: result.order, warnings: result.warnings })
}
