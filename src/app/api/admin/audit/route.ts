import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveActorNames } from '@/lib/staff'
import { isMissingOpsRelation } from '@/lib/ops/server'

const PAGE_SIZE = 50

const querySchema = z.object({
  table: z.string().min(1).optional(),
  row_id: z.string().min(1).optional(),
  actor: z.string().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
})

// canAccess() (src/lib/staff-policy.ts) already restricts /api/admin/audit to owner/admin, so
// requireStaff() below has already turned away the operations role with a 403.
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', code: 'invalid', details: parsed.error.flatten() },
      { status: 400 },
    )
  }
  const { table, row_id, actor, page } = parsed.data
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    let query = supabase
      .from('audit_log')
      .select('id, occurred_at, actor, table_name, row_id, action, changes', { count: 'exact' })
      .order('occurred_at', { ascending: false })
    if (table) query = query.eq('table_name', table)
    if (row_id) query = query.eq('row_id', row_id)
    if (actor) query = query.eq('actor', actor)
    const start = (page - 1) * PAGE_SIZE
    const { data, error, count } = await query.range(start, start + PAGE_SIZE - 1)
    if (error) throw error
    const names = await resolveActorNames(supabase, (data ?? []).map((row) => row.actor))
    const entries = (data ?? []).map((row) => ({
      id: row.id,
      occurred_at: row.occurred_at,
      actor: row.actor ?? null,
      actor_name: row.actor ? (names[row.actor] ?? null) : null,
      table_name: row.table_name,
      row_id: row.row_id,
      action: row.action,
      changes: row.changes,
    }))
    return NextResponse.json({ entries, total: count ?? entries.length, page })
  } catch (error) {
    console.error('audit list error:', error)
    return NextResponse.json(
      { error: 'Failed to load audit log', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
