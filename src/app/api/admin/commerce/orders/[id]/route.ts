import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ledgerOnlyFieldsIn } from '@/lib/ops/ledger-fields'
import { applyCommerceOrderPatch } from '@/lib/orders'
import { STATUSES, WorkflowError, allowedNextStatuses, assertTransition } from '@/lib/request-workflow'

const updateSchema = z.object({
  status: z.enum(STATUSES.commerce_order).optional(),
  /** The status the operator's screen showed; a mismatch is refused as stale. */
  expected_status: z.enum(STATUSES.commerce_order).optional(),
  internal_notes: z.string().max(2000).optional(),
})

type OrderStatus = (typeof STATUSES.commerce_order)[number]

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('commerce_orders')
    .select('*, customers(id, name, phone, whatsapp_phone, normalized_phone), commerce_order_items(*), delivery_zones(name_ar, name_en)')
    .eq('id', id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  return NextResponse.json({ order: data })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const ledgerFields = ledgerOnlyFieldsIn(body)
  if (ledgerFields.length) {
    return NextResponse.json({
      error: 'Payments are recorded through POST /api/admin/payments',
      code: 'payment_via_ledger',
      fields: ledgerFields,
    }, { status: 400 })
  }
  const validated = updateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { expected_status: callerExpected, ...fields } = validated.data
  let expectedStatus = callerExpected
  if (fields.status) {
    const supabase = getSupabaseAdmin(gate.staff)
    const { data: current, error: currentError } = await supabase
      .from('commerce_orders')
      .select('status, fulfillment_method')
      .eq('id', id)
      .maybeSingle()
    if (currentError) return NextResponse.json({ error: 'Failed to load order' }, { status: 500 })
    if (!current) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    const from = current.status as OrderStatus
    // A screen that says which status it saw gets a stale answer rather than
    // a silently different transition; the database re-checks under a lock.
    if (callerExpected && callerExpected !== from) {
      return NextResponse.json(
        { error: 'Order status changed', code: 'stale_status', current_status: from },
        { status: 409 },
      )
    }
    const ctx = { fulfillmentMethod: current.fulfillment_method as string }
    try {
      assertTransition('commerce_order', from, fields.status, ctx)
    } catch (error) {
      if (error instanceof WorkflowError) {
        return NextResponse.json(
          { code: 'invalid_transition', allowed: allowedNextStatuses('commerce_order', from, ctx) },
          { status: 409 },
        )
      }
      throw error
    }
    expectedStatus = from
  }
  const result = await applyCommerceOrderPatch(id, { ...fields, expectedStatus }, gate.staff)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status },
    )
  }
  return NextResponse.json({ order: result.order, warnings: result.warnings })
}
