import 'server-only'
import { requestJourney, type JourneyLookups } from './request-journey'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { resolveActorNames } from '@/lib/staff'
import { todayInCairo } from '@/lib/transport/today'
import { normalizeOpsQuery } from './search'
import { deriveWorkItem, type OpsView, type WorkItemRow } from './work-items'
import type { Activity, OpsEntityType, WorkItem } from './types'

type Filters = {
  view?: OpsView
  type?: OpsEntityType
  status?: string
  payment?: string
  from?: string
  to?: string
  /** Which date column from/to filter: 'start' (start_date, default) or 'end' (end_date). */
  dateField?: 'start' | 'end'
  /** Only rows with a transfer_type set (the "transfers needing attention" tile). */
  transferOnly?: boolean
  q?: string
  today?: string
}

export function isMissingOpsRelation(error: unknown): boolean {
  const code = (error as { code?: string } | null | undefined)?.code
  return code === 'PGRST205' || code === '42P01'
}

/** The base query for both the main list and the cancelled-with-money-held exception below. */
function baseQuery(supabase: SupabaseClient, filters: Filters) {
  const dateColumn = filters.dateField === 'end' ? 'end_date' : 'start_date'
  let query = supabase.from('ops_work_items').select('*')
  if (filters.type) query = query.eq('entity_type', filters.type)
  if (filters.from) query = query.gte(dateColumn, filters.from)
  if (filters.to) query = query.lte(dateColumn, filters.to)
  if (filters.transferOnly) query = query.not('transfer_type', 'is', null)
  if (filters.q) {
    const normalized = normalizeOpsQuery(filters.q)
    if (normalized.text) {
      const value = normalized.text.replace(/,/g, ' ')
      query = query.or(
        `customer_name.ilike.%${value}%,customer_phone.ilike.%${value}%,`
        + `reference.ilike.%${value}%,title_en.ilike.%${value}%,title_ar.ilike.%${value}%`,
      )
    }
  }
  return query
}

/**
 * Loads the rows a queue view derives from. Bounded to 1000 non-terminal rows per query: the
 * Operations Center is a live work queue, not a full-history report, so a derived view (anything
 * but view=all) never needs to reason about more open items than that at once. GRAPH_REPORT-scale
 * exports go through the catalogue/reporting surfaces instead.
 */
export async function loadWorkItems(supabase: SupabaseClient, filters: Filters = {}): Promise<WorkItem[]> {
  const view = filters.view ?? 'all'
  const derived = view !== 'all'
  let query = baseQuery(supabase, filters)
  if (filters.status) query = query.eq('status', filters.status)
  else if (derived) query = query.not('status', 'in', '(completed,cancelled)')
  if (filters.payment) query = query.eq('payment_status', filters.payment)
  if (derived) query = query.limit(1000)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as WorkItemRow[]
  if (derived && !filters.status) {
    // The terminal exclusion above cannot express cancelled rows carrying refundable money.
    const refundQuery = baseQuery(supabase, filters).eq('status', 'cancelled').gt('amount_paid', 0).limit(1000)
    const { data: refunds, error: refundsError } = await refundQuery
    if (refundsError) throw refundsError
    const seen = new Set(rows.map((row) => row.entity_id))
    for (const refund of refunds ?? []) if (!seen.has(refund.entity_id)) rows.push(refund)
  }
  return deriveRows(supabase, rows, filters.today)
}

/** Shared derivation step: the latest status_history change per row plus current payment rules. */
async function deriveRows(supabase: SupabaseClient, rows: WorkItemRow[], today?: string): Promise<WorkItem[]> {
  const ids = [...new Set(rows.map((row) => row.entity_id))]
  const changes: Record<string, string> = {}
  if (ids.length) {
    const { data: history, error: historyError } = await supabase
      .from('status_history')
      .select('entity_id, changed_at')
      .in('entity_id', ids)
      .order('changed_at', { ascending: false })
    if (historyError) throw historyError
    for (const change of history ?? []) {
      if (!changes[change.entity_id]) changes[change.entity_id] = change.changed_at
    }
  }
  const rules = await getPaymentRules()
  const resolvedToday = today ?? todayInCairo()
  return rows.map((row) => deriveWorkItem(row, {
    lastChangeAt: changes[row.entity_id], now: new Date(), today: resolvedToday, policies: rules.policies,
  }))
}

/** A single work item by its primary key, for the detail route. Null when it does not exist. */
export async function loadWorkItemByEntity(
  supabase: SupabaseClient, entityType: OpsEntityType, entityId: string, today?: string,
): Promise<WorkItem | null> {
  const { data, error } = await supabase
    .from('ops_work_items').select('*').eq('entity_type', entityType).eq('entity_id', entityId).maybeSingle()
  if (error) throw error
  if (!data) return null
  const [derived] = await deriveRows(supabase, [data], today)
  return derived
}

/** Every row (of any entity type) that came from, or was converted from, the same trip_request. */
export async function loadWorkItemsByTripRequest(
  supabase: SupabaseClient, tripRequestId: string, today?: string,
): Promise<WorkItem[]> {
  const { data, error } = await supabase.from('ops_work_items').select('*').eq('trip_request_id', tripRequestId)
  if (error) throw error
  return deriveRows(supabase, data ?? [], today)
}

/** Every request/booking/order raised by one customer, for the customer profile screen. */
export async function loadWorkItemsByCustomer(
  supabase: SupabaseClient, customerId: string, today?: string,
): Promise<WorkItem[]> {
  const { data, error } = await supabase.from('ops_work_items').select('*').eq('customer_id', customerId)
  if (error) throw error
  return deriveRows(supabase, data ?? [], today)
}

export async function loadActivity(
  supabase: SupabaseClient,
  options: { entityIds?: string[], limit: number },
): Promise<Activity[]> {
  const limit = options.limit
  let histories = supabase
    .from('status_history')
    .select('entity_type, entity_id, field, from_value, to_value, actor, changed_at')
    .order('changed_at', { ascending: false })
    .limit(limit)
  let payments = supabase
    .from('payment_records')
    .select('entity_type, entity_id, direction, amount, method, recorded_by, received_at')
    .order('received_at', { ascending: false })
    .limit(limit)
  if (options.entityIds?.length) {
    histories = histories.in('entity_id', options.entityIds)
    payments = payments.in('entity_id', options.entityIds)
  }
  const [historyResult, paymentResult] = await Promise.all([histories, payments])
  if (historyResult.error) throw historyResult.error
  if (paymentResult.error) throw paymentResult.error
  const allRows = [...(historyResult.data ?? []), ...(paymentResult.data ?? [])]
  const ids = [...new Set(allRows.map((row) => row.entity_id))]
  const { data: workRows, error: workError } = ids.length
    ? await supabase.from('ops_work_items').select('entity_id, reference, customer_name').in('entity_id', ids)
    : { data: [], error: null }
  if (workError) throw workError
  const details = new Map((workRows ?? []).map((row) => [row.entity_id, row]))
  type RawActivity = {
    kind: Activity['kind']; entity_type: string; entity_id: string; actor: string | null; at: string
    from_value?: string | null; to_value?: string | null; amount?: number; method?: string
  }
  const raw: RawActivity[] = [
    ...(historyResult.data ?? []).map((row) => ({
      kind: (row.field === 'payment_status' ? 'payment_status' : 'status') as Activity['kind'],
      entity_type: row.entity_type, entity_id: row.entity_id, actor: row.actor, at: row.changed_at,
      from_value: row.from_value, to_value: row.to_value,
    })),
    ...(paymentResult.data ?? []).map((row) => ({
      kind: (row.direction === 'refunded' ? 'refund' : 'payment') as Activity['kind'],
      entity_type: row.entity_type, entity_id: row.entity_id, actor: row.recorded_by, at: row.received_at,
      amount: Number(row.amount), method: row.method,
    })),
  ]
  const names = await resolveActorNames(supabase, raw.map((row) => row.actor))
  return raw.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit).map((row) => {
    const detail = details.get(row.entity_id) ?? { reference: '', customer_name: '' }
    return {
      kind: row.kind, entity_type: row.entity_type, entity_id: row.entity_id,
      reference: detail.reference, customer_name: detail.customer_name,
      from_value: row.from_value ?? null, to_value: row.to_value ?? null,
      ...(row.amount !== undefined ? { amount: row.amount, method: row.method } : {}),
      actor: row.actor ?? null, actor_name: row.actor ? names[row.actor] ?? null : null, at: row.at,
    } as Activity
  })
}

/** Readable names for a submitted request's journey; prices stay those in its frozen snapshot. */
export async function loadRequestJourney(supabase: SupabaseClient, record: Record<string, unknown>) {
  const experiences = Array.isArray(record.experiences) ? record.experiences as { kind?: string; id?: string }[] : []
  const tripIds = experiences.filter((e) => e.kind === 'trip' && e.id).map((e) => e.id as string)
  const packageIds = experiences.filter((e) => e.kind === 'trip_package' && e.id).map((e) => e.id as string)
  const origin = typeof record.origin_governorate_code === 'string' ? record.origin_governorate_code : null
  const accommodationId = typeof record.accommodation_id === 'string' ? record.accommodation_id : null
  const none = Promise.resolve({ data: [] as Record<string, unknown>[], error: null })

  const [origins, trips, packages, accommodation] = await Promise.all([
    origin
      ? supabase.from('transfer_governorate_pricing').select('governorate_code, name_ar, name_en')
        .eq('governorate_code', origin).limit(1)
      : none,
    tripIds.length ? supabase.from('sinai_trips').select('id, name_ar, name_en').in('id', tripIds) : none,
    packageIds.length ? supabase.from('trip_packages').select('id, name_ar, name_en').in('id', packageIds) : none,
    accommodationId
      ? supabase.from('accommodations').select('meal_plans').eq('id', accommodationId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const byId = (rows: Record<string, unknown>[] | null, key: string) => Object.fromEntries((rows ?? []).map((row) => [
    String(row[key]), { name_ar: String(row.name_ar ?? ''), name_en: String(row.name_en ?? '') },
  ]))
  const mealPlans = (accommodation.data as { meal_plans?: unknown } | null)?.meal_plans
  return requestJourney(record, {
    origins: byId(origins.data as Record<string, unknown>[] | null, 'governorate_code'),
    trips: byId(trips.data as Record<string, unknown>[] | null, 'id'),
    packages: byId(packages.data as Record<string, unknown>[] | null, 'id'),
    mealPlans: Array.isArray(mealPlans) ? mealPlans as JourneyLookups['mealPlans'] : [],
  })
}
