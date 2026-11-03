import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport/today'
import { isMissingOpsRelation, loadWorkItems } from '@/lib/ops/server'
import { filterByView, isCommercialItem, isJourneyItem, isTripItem, QUEUE_SORTS, sortForView } from '@/lib/ops/work-items'

const VIEWS = ['needs_action', 'awaiting_payment', 'upcoming', 'stale', 'exceptions', 'all'] as const
const ENTITY_TYPES = [
  'accommodation_booking', 'trip_booking', 'signature_request', 'trip_request', 'commerce_order', 'edition_request',
] as const

const querySchema = z.object({
  view: z.enum(VIEWS).default('needs_action'),
  type: z.enum(ENTITY_TYPES).optional(),
  status: z.string().min(1).optional(),
  payment: z.enum(['unpaid', 'partial', 'paid', 'refunded']).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_field: z.enum(['start', 'end']).default('start'),
  transfer: z.enum(['0', '1']).optional(),
  // Mirrors the Today tile counts exactly: journey = isJourneyItem (arrivals/departures, incl. journey
  // components), trips = isTripItem, transfer_attention = commercial rows flagged transfer_unconfirmed.
  scope: z.enum(['journey', 'trips', 'transfer_attention']).optional(),
  // Reference day for date-relative flags (the Today date picker); defaults to today in Cairo.
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q: z.string().max(200).optional(),
  // Omitted = the view's own default (newest first; upcoming by date; stale longest-waiting).
  sort: z.enum(QUEUE_SORTS).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
})

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
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const filter = parsed.data
    const today = filter.today ?? todayInCairo()
    const scoped = !!filter.scope
    const items = await loadWorkItems(supabase, {
      ...filter,
      // A scoped list is counted from every row (view 'all'), components included where the tile counts them.
      view: scoped ? 'all' : filter.view,
      includeComponents: filter.scope === 'journey' || filter.scope === 'trips',
      today, dateField: filter.date_field, transferOnly: filter.transfer === '1',
    })
    let displayed
    if (filter.scope === 'journey') displayed = sortForView(items.filter(isJourneyItem), 'all', filter.sort)
    else if (filter.scope === 'trips') displayed = sortForView(items.filter(isTripItem), 'all', filter.sort)
    else if (filter.scope === 'transfer_attention') {
      displayed = sortForView(
        items.filter((item) => isCommercialItem(item) && item.attention.includes('transfer_unconfirmed')), 'all', filter.sort,
      )
    } else displayed = sortForView(filterByView(items, filter.view, today), filter.view, filter.sort)
    const start = (filter.page - 1) * filter.page_size
    return NextResponse.json({
      items: displayed.slice(start, start + filter.page_size),
      total: displayed.length,
      page: filter.page,
      page_size: filter.page_size,
    })
  } catch (error) {
    console.error('ops queue error:', error)
    return NextResponse.json(
      { error: 'Failed to load queue', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
