import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { mapRpcError } from '@/lib/ops/rpc-errors'
import { getSupabaseAdmin } from '@/lib/supabase'
import { ledgerOnlyFieldsIn } from '@/lib/ops/ledger-fields'
import { STATUSES } from '@/lib/request-workflow'
import { updateAdminStatus } from '@/lib/admin-status-update'

const updateSchema = z.object({
  status: z.enum(STATUSES.signature_request).optional(),
  quoted_price: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
})

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
  const supabase = getSupabaseAdmin(gate.staff)
  const result = await updateAdminStatus({
    readStatus: async (bookingId) => supabase.from('experience_bookings').select('status').eq('id', bookingId).maybeSingle(),
    update: async (bookingId, patch, currentStatus) => {
      let query = supabase.from('experience_bookings').update(patch).eq('id', bookingId)
      if (currentStatus !== undefined) query = query.eq('status', currentStatus)
      return query.select().maybeSingle()
    },
  }, 'signature_request', id, validated.data)

  if (result.kind === 'invalid_transition') {
    return NextResponse.json({ error: 'Invalid status transition', code: result.kind, allowed: result.allowed }, { status: 409 })
  }
  if (result.kind === 'stale_status') {
    return NextResponse.json({ error: 'Request status changed by another admin', code: result.kind }, { status: 409 })
  }
  if (result.kind === 'not_found') return NextResponse.json({ error: 'Request not found' }, { status: 404 })
  if (result.kind === 'error') {
    const mapped = mapRpcError(result.error as { message?: string; code?: string })
    if (mapped) return NextResponse.json({ error: mapped.code, code: mapped.code }, { status: mapped.status })
    return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
  }
  return NextResponse.json({ request: result.data })
}
