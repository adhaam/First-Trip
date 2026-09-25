import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { OPS_ENTITY_TABLES, type OpsEntityType } from '@/lib/ops/types'
import { isMissingOpsRelation } from '@/lib/ops/server'

const bodySchema = z.object({ internal_notes: z.string().max(4000), expected_updated_at: z.string().min(1) })

// experience_bookings (signature_request) has no internal_notes column (see supabase migrations) --
// staff notes on Signature requests are not supported yet.
const UNSUPPORTED: readonly OpsEntityType[] = ['signature_request']

export async function POST(req: NextRequest, { params }: { params: Promise<{ type: string, id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { type, id } = await params
  if (!(type in OPS_ENTITY_TABLES)) return NextResponse.json({ error: 'Unknown item type' }, { status: 404 })
  const entityType = type as OpsEntityType
  if (UNSUPPORTED.includes(entityType)) {
    return NextResponse.json({ error: 'Notes unsupported', code: 'unsupported' }, { status: 400 })
  }
  const body = bodySchema.safeParse(await req.json().catch(() => null))
  if (!body.success) {
    return NextResponse.json({ error: 'Invalid data', code: 'invalid', details: body.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const table = OPS_ENTITY_TABLES[entityType].table
    const { data, error } = await supabase
      .from(table)
      .update({ internal_notes: body.data.internal_notes })
      .eq('id', id)
      .eq('updated_at', body.data.expected_updated_at)
      .select('internal_notes, updated_at')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: 'Record changed', code: 'stale_record' }, { status: 409 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('ops notes update error:', error)
    return NextResponse.json(
      { error: 'Failed to update notes', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
