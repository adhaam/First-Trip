import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { amendErrorResponse, isAmendError, loadAmendableRow, loadRevisionViews } from '@/lib/trip-requests/amend.server'
import { revisionListItems } from '@/lib/trip-requests/revisions'

// The versions of a journey, newest first. A request that was never amended reports its current
// state as a virtual revision 1.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const loaded = await loadAmendableRow(supabase, id)
  if (isAmendError(loaded)) return amendErrorResponse(loaded)
  const views = await loadRevisionViews(supabase, loaded.row)
  if (isAmendError(views)) return amendErrorResponse(views)
  const revisions = revisionListItems(views)

  // Show staff by name, not by the `staff:<uuid>` actor id the RPC records.
  const staffIds = [...new Set(revisions
    .map((revision) => revision.created_by?.match(/^staff:([0-9a-f-]{36})$/i)?.[1])
    .filter((value): value is string => Boolean(value)))]
  if (staffIds.length) {
    const { data: staff } = await supabase.from('staff_users').select('id, display_name').in('id', staffIds)
    const names = new Map((staff ?? []).map((member) => [`staff:${member.id}`, member.display_name as string]))
    for (const revision of revisions) {
      if (revision.created_by && names.has(revision.created_by)) revision.created_by = names.get(revision.created_by)!
    }
  }
  return NextResponse.json({ revisions, status: loaded.row.status })
}
