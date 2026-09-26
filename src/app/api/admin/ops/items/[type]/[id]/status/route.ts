import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { updateAdminStatus } from '@/lib/admin-status-update'
import { getSupabaseAdmin } from '@/lib/supabase'
import { OPS_ENTITY_TABLES, type OpsEntityType } from '@/lib/ops/types'
import { isMissingOpsRelation, loadWorkItemByEntity } from '@/lib/ops/server'
import { applyOrderPatchWithClient, type OrderStatus } from '@/lib/order-core'
import { allowedNextStatuses, canTransition, type RequestStatus } from '@/lib/request-workflow'

const bodySchema = z.object({ status: z.string().min(1), expected_status: z.string().min(1) })

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string, id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { type, id } = await params
  if (!(type in OPS_ENTITY_TABLES)) return NextResponse.json({ error: 'Unknown item type' }, { status: 404 })
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid data', code: 'invalid', details: body.error.flatten() }, { status: 400 })
  }
  const entityType = type as OpsEntityType
  const config = OPS_ENTITY_TABLES[entityType]!
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const { data: current, error } = await supabase.from(config.table).select('status').eq('id', id).maybeSingle()
    if (error) throw error
    if (!current) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (current.status !== body.data.expected_status) {
      return NextResponse.json(
        { error: 'Status changed', code: 'stale_status', current_status: current.status },
        { status: 409 },
      )
    }
    if (entityType === 'commerce_order') {
      // Orders carry inventory side effects (restock on cancel, re-reserve on
      // reopen) and the pickup/delivery split; both live in one database
      // transaction (migration 039), never a plain status write.
      const { data: order, error: orderError } = await supabase
        .from('commerce_orders').select('fulfillment_method').eq('id', id).maybeSingle()
      if (orderError) throw orderError
      const ctx = { fulfillmentMethod: order?.fulfillment_method as string | undefined }
      if (!canTransition('commerce_order', current.status, body.data.status, ctx)) {
        return NextResponse.json(
          {
            error: 'Invalid status transition',
            code: 'invalid_transition',
            allowed: allowedNextStatuses('commerce_order', current.status as RequestStatus<'commerce_order'>, ctx),
          },
          { status: 409 },
        )
      }
      const patched = await applyOrderPatchWithClient(supabase, id, {
        status: body.data.status as OrderStatus,
        expectedStatus: body.data.expected_status as OrderStatus,
      })
      if (!patched.ok) {
        return NextResponse.json(
          { error: patched.error, ...(patched.code ? { code: patched.code } : {}) },
          { status: patched.status },
        )
      }
      const item = await loadWorkItemByEntity(supabase, entityType, id)
      if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
      return NextResponse.json({ item })
    }
    const result = await updateAdminStatus(
      {
        readStatus: async (rowId) => supabase.from(config.table).select('status').eq('id', rowId).maybeSingle(),
        update: async (rowId, patch, currentStatus) => {
          const query = supabase.from(config.table).update(patch).eq('id', rowId)
          const scoped = currentStatus ? query.eq('status', currentStatus) : query
          return scoped.select().maybeSingle()
        },
      },
      config.domain,
      id,
      { status: body.data.status },
    )
    if (result.kind === 'not_found') return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    if (result.kind === 'stale_status') {
      return NextResponse.json({ error: 'Status changed', code: 'stale_status' }, { status: 409 })
    }
    if (result.kind === 'invalid_transition') {
      return NextResponse.json(
        { error: 'Invalid status transition', code: 'invalid_transition', allowed: result.allowed },
        { status: 409 },
      )
    }
    if (result.kind === 'error') throw result.error
    const item = await loadWorkItemByEntity(supabase, entityType, id)
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    return NextResponse.json({ item })
  } catch (error) {
    console.error('ops status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update item', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
