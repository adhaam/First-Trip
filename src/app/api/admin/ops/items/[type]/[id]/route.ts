import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport/today'
import { paymentPlan, type PaymentKind } from '@/lib/payment-rules'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { resolveActorNames } from '@/lib/staff'
import { allowedNextStatuses, type RequestStatus } from '@/lib/request-workflow'
import { isMissingOpsRelation, loadWorkItemByEntity, loadWorkItemsByTripRequest, loadRequestJourney } from '@/lib/ops/server'
import { OPS_ENTITY_TABLES, type OpsEntityType, type WorkItem } from '@/lib/ops/types'
import type { PaymentPolicy } from '@/lib/payment-rules'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Matches the status_history columns selected below. */
type HistoryRow = {
  field: string
  from_value: string | null
  to_value: string | null
  actor: string | null
  changed_at: string
}
/** Matches the payment_records columns selected below. */
type PaymentRow = {
  id: string
  direction: string
  amount: number | string
  method: string
  reference: string | null
  note: string | null
  received_at: string
  recorded_by: string | null
  amount_paid_after: number | string
}
/** Matches the audit_log columns selected below. */
type AuditRow = {
  id: string
  occurred_at: string
  actor: string | null
  action: string
  changes: unknown
}

/** The joined names each entity's record carries, matching how the admin dashboard already reads them. */
const RECORD_SELECT: Record<OpsEntityType, string> = {
  accommodation_booking: '*, accommodations(name_ar, name_en)',
  trip_booking: '*, sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)',
  signature_request: '*, experiences(title_ar, title_en), experience_dates(start_date, end_date)',
  trip_request: '*, accommodations(name_ar, name_en), stay_patterns(name_ar, name_en)',
  commerce_order: '*, commerce_order_items(*, rental_reservations(*)), delivery_zones(name_ar, name_en)',
}

/** Mirrors the paid_states arrays in weemap_record_payment() (migration 036). trip_request never takes money. */
function paymentAllowedFor(type: OpsEntityType, status: string): boolean {
  if (type === 'trip_request') return false
  if (type === 'commerce_order') {
    return ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed'].includes(status)
  }
  return ['awaiting_payment', 'confirmed', 'completed'].includes(status)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ type: string, id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { type, id } = await params
  if (!(type in OPS_ENTITY_TABLES)) return NextResponse.json({ error: 'Unknown item type' }, { status: 404 })
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  const entityType = type as OpsEntityType
  const { table } = OPS_ENTITY_TABLES[entityType]
  const supabase = getSupabaseAdmin(gate.staff)

  try {
    const today = todayInCairo()
    const item = await loadWorkItemByEntity(supabase, entityType, id, today)
    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const [
      recordResult,
      historyResult,
      paymentsResult,
      auditResult,
      customerResult,
      relatedRows,
      rules,
    ] = await Promise.all([
      supabase.from(table).select(RECORD_SELECT[entityType]).eq('id', id).maybeSingle(),
      supabase.from('status_history')
        .select('field, from_value, to_value, actor, changed_at')
        .eq('entity_id', id)
        .order('changed_at', { ascending: true }),
      supabase.from('payment_records')
        .select('id, direction, amount, method, reference, note, received_at, recorded_by, amount_paid_after')
        .eq('entity_id', id)
        .order('received_at', { ascending: true }),
      gate.staff.role === 'operations'
        ? Promise.resolve({ data: [] as AuditRow[], error: null })
        : supabase.from('audit_log')
          .select('id, occurred_at, actor, action, changes')
          .eq('table_name', table)
          .eq('row_id', id)
          .order('occurred_at', { ascending: false }),
      item.customer_id
        ? supabase.from('customers').select('id, name, phone, email').eq('id', item.customer_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      item.trip_request_id
        ? loadWorkItemsByTripRequest(supabase, item.trip_request_id, today)
        : Promise.resolve([] as WorkItem[]),
      getPaymentRules(),
    ])

    if (recordResult.error) throw recordResult.error
    if (historyResult.error) throw historyResult.error
    if (paymentsResult.error) throw paymentsResult.error
    if (auditResult.error) throw auditResult.error
    if (customerResult.error) throw customerResult.error
    if (!recordResult.data) return NextResponse.json({ error: 'Item not found' }, { status: 404 })

    const historyRows = (historyResult.data ?? []) as HistoryRow[]
    const paymentRows = (paymentsResult.data ?? []) as PaymentRow[]
    const auditRows = (auditResult.data ?? []) as AuditRow[]

    const actors = [
      ...historyRows.map((row) => row.actor),
      ...auditRows.map((row) => row.actor),
    ]
    const names = await resolveActorNames(supabase, actors)

    const history = historyRows.map((row) => ({
      field: row.field,
      from_value: row.from_value,
      to_value: row.to_value,
      actor: row.actor ?? null,
      actor_name: row.actor ? (names[row.actor] ?? null) : null,
      changed_at: row.changed_at,
    }))

    const payments = paymentRows.map((row) => ({
      id: row.id,
      direction: row.direction,
      amount: Number(row.amount),
      method: row.method,
      reference: row.reference,
      note: row.note,
      received_at: row.received_at,
      recorded_by: row.recorded_by ?? null,
      recorded_by_name: row.recorded_by ? (names[row.recorded_by] ?? null) : null,
      amount_paid_after: Number(row.amount_paid_after),
    }))

    const audit = auditRows.map((row) => ({
      id: row.id,
      occurred_at: row.occurred_at,
      action: row.action,
      changes: row.changes,
      actor: row.actor ?? null,
      actor_name: row.actor ? (names[row.actor] ?? null) : null,
    }))

    const related = {
      trip_request: entityType === 'trip_request'
        ? null
        : relatedRows.find((row) => row.entity_type === 'trip_request') ?? null,
      items: relatedRows.filter((row) => (
        row.entity_type !== 'trip_request' && !(row.entity_type === entityType && row.entity_id === id)
      )),
    }

    const payment_expectation = entityType === 'trip_request' || !item.payment_kind || item.amount_total === null
      ? null
      : buildPaymentExpectation(item, rules.policies)

    const domain = OPS_ENTITY_TABLES[entityType].domain
    const allowed_statuses = allowedNextStatuses(domain, item.status as RequestStatus<typeof domain>)
      .filter((status) => status !== item.status)

    const record = recordResult.data as unknown as Record<string, unknown>
    if (entityType === 'trip_request') record.journey = await loadRequestJourney(supabase, record)

    return NextResponse.json({
      item,
      record,
      history,
      payments,
      audit,
      related,
      customer: customerResult.data ?? null,
      payment_expectation,
      allowed_statuses,
      payment_allowed: paymentAllowedFor(entityType, item.status),
      can_convert: entityType === 'trip_request'
        && !record.converted_booking_id
        && ['awaiting_payment', 'confirmed'].includes(item.status),
    })
  } catch (error) {
    console.error('ops item detail error:', error)
    return NextResponse.json(
      { error: 'Failed to load item', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}

function buildPaymentExpectation(item: WorkItem, policies: readonly PaymentPolicy[]) {
  const plan = paymentPlan(item.payment_kind as PaymentKind, item.amount_total as number, policies)
  if (plan.rule !== 'policy') return null
  const amountPaid = item.amount_paid ?? 0
  return {
    kind: item.payment_kind,
    total: item.amount_total,
    upfront_percent: plan.upfrontPercent,
    upfront_amount: plan.upfrontAmount,
    balance_amount: plan.balanceAmount,
    balance_due: plan.balanceDue,
    amount_paid: amountPaid,
    outstanding_now: item.outstanding_now,
    outstanding_total: (item.amount_total as number) - amountPaid,
  }
}
