import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport/today'
import { isMissingOpsRelation, loadActivity, loadWorkItemsByCustomer } from '@/lib/ops/server'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Matches the payment_records columns selected below. */
type PaymentRecordRow = {
  id: string
  entity_type: string
  entity_id: string
  direction: string
  amount: number | string
  method: string
  reference: string | null
  note: string | null
  received_at: string
  recorded_by: string | null
  amount_paid_after: number | string
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const [customerResult, mergedFromResult, items] = await Promise.all([
      supabase.from('customers')
        .select([
          'id', 'name', 'phone', 'email', 'normalized_phone', 'whatsapp_phone', 'preferred_language',
          'primary_address', 'notes', 'total_bookings', 'last_booking_at', 'last_activity_at',
          'created_at', 'updated_at', 'merged_into',
        ].join(', '))
        .eq('id', id)
        .maybeSingle(),
      supabase.from('customers').select('id, name, phone').eq('merged_into', id),
      loadWorkItemsByCustomer(supabase, id, todayInCairo()),
    ])
    if (customerResult.error) throw customerResult.error
    if (mergedFromResult.error) throw mergedFromResult.error
    if (!customerResult.data) return NextResponse.json({ error: 'Customer not found' }, { status: 404 })

    const sortedItems = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at))
    const entityIds = items.map((item) => item.entity_id)
    const referenceByEntity = new Map(items.map((item) => [item.entity_id, item]))

    const [paymentsResult, activity] = await Promise.all([
      entityIds.length
        ? supabase.from('payment_records')
          .select([
            'id', 'entity_type', 'entity_id', 'direction', 'amount', 'method', 'reference', 'note',
            'received_at', 'recorded_by', 'amount_paid_after',
          ].join(', '))
          .in('entity_id', entityIds)
          .order('received_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      loadActivity(supabase, { entityIds, limit: 50 }),
    ])
    if (paymentsResult.error) throw paymentsResult.error

    const paymentRows = (paymentsResult.data ?? []) as PaymentRecordRow[]
    const payments = paymentRows.map((row) => ({
      ...row,
      amount: Number(row.amount),
      amount_paid_after: Number(row.amount_paid_after),
      reference: referenceByEntity.get(row.entity_id)?.reference ?? '',
    }))

    const openItems = sortedItems.filter((item) => !['completed', 'cancelled'].includes(item.status))
    const totals = {
      items: sortedItems.length,
      open_items: openItems.length,
      lifetime_paid: sortedItems.reduce((sum, item) => sum + (item.amount_paid ?? 0), 0),
      outstanding_now: sortedItems.reduce((sum, item) => sum + (item.outstanding_now ?? 0), 0),
    }

    return NextResponse.json({
      customer: customerResult.data,
      merged_from: mergedFromResult.data ?? [],
      items: sortedItems,
      payments,
      activity,
      totals,
    })
  } catch (error) {
    console.error('customer profile error:', error)
    return NextResponse.json(
      {
        error: 'Failed to load customer profile',
        ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}),
      },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
