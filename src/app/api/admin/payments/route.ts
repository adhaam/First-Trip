import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { mapRpcError } from '@/lib/ops/rpc-errors'

// Records money received or refunded through the append-only ledger
// (weemap_record_payment, migration 036). The database decides the resulting
// payment_status, refuses money before availability is confirmed and rejects a
// stale screen via expected_amount_paid. payment_kind is never touched here.
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000

const paymentSchema = z.object({
  entity_type: z.enum(['accommodation_booking', 'trip_booking', 'signature_request', 'commerce_order']),
  entity_id: z.string().uuid(),
  direction: z.enum(['received', 'refunded']),
  amount: z.number().positive().max(10_000_000)
    .refine((value) => Math.round(value * 100) === value * 100, 'At most two decimals'),
  method: z.enum(['instapay', 'vodafonecash', 'cash', 'card_link', 'bank_transfer', 'other']),
  expected_amount_paid: z.number().min(0),
  reference: z.string().trim().max(200).optional(),
  note: z.string().trim().max(1000).optional(),
  received_at: z.string().datetime({ offset: true }).optional()
    .refine((value) => !value || Date.parse(value) <= Date.now() + FUTURE_TOLERANCE_MS, 'Cannot be in the future'),
}).strict()

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const parsed = paymentSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', code: 'invalid', details: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

  const { data, error } = await getSupabaseAdmin(gate.staff).rpc('weemap_record_payment', {
    p_entity_type: body.entity_type,
    p_entity_id: body.entity_id,
    p_direction: body.direction,
    p_amount: body.amount,
    p_method: body.method,
    p_expected_amount_paid: body.expected_amount_paid,
    p_reference: body.reference ?? '',
    p_note: body.note ?? '',
    p_received_at: body.received_at ?? null,
  })
  if (error) {
    const mapped = mapRpcError(error)
    if (mapped) return NextResponse.json({ error: mapped.code, code: mapped.code }, { status: mapped.status })
    console.error('record payment error:', error)
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
  }
  return NextResponse.json(data)
}
