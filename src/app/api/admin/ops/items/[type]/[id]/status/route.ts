import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { updateAdminStatus } from '@/lib/admin-status-update'
import { getSupabaseAdmin } from '@/lib/supabase'
import { OPS_ENTITY_TABLES, type OpsEntityType } from '@/lib/ops/types'
import { isMissingOpsRelation, loadWorkItemByEntity } from '@/lib/ops/server'

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
  const config = OPS_ENTITY_TABLES[entityType]
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
    const result = await updateAdminStatus(
      {
        readStatus: async (rowId) => supabase.from(config.table).select('status').eq('id', rowId).maybeSingle(),
        update: async (rowId, patch, currentStatus) => {
          let query: any = supabase.from(config.table).update(patch).eq('id', rowId)
          if (currentStatus) query = query.eq('status', currentStatus)
          return query.select().maybeSingle()
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
