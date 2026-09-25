import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { todayInCairo } from '@/lib/transport/today'
import { loadActivity, loadWorkItems, isMissingOpsRelation } from '@/lib/ops/server'
import { filterByView, sortForView, todayCounts, isJourneyItem, isTripItem } from '@/lib/ops/work-items'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const date = req.nextUrl.searchParams.get('date') ?? todayInCairo()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'Invalid date', code: 'invalid' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const items = await loadWorkItems(supabase, { view: 'all', today: date })
    // A converted trip_request's arrival/departure is already represented by the concrete
    // bookings it produced; keep only the unconverted request so the day isn't double-counted.
    const active = items.filter((item) => (
      item.status !== 'cancelled' && !(item.entity_type === 'trip_request' && item.payment_status === 'converted')
    ))
    const upcoming = filterByView(active, 'upcoming', date)
    return NextResponse.json({
      date,
      counts: todayCounts(items, date),
      sections: {
        needs_action: sortForView(filterByView(items, 'needs_action', date), 'needs_action').slice(0, 50),
        arrivals: active.filter((item) => isJourneyItem(item) && item.start_date === date),
        departures: active.filter((item) => isJourneyItem(item) && item.end_date === date),
        trips: active.filter((item) => isTripItem(item) && item.start_date === date),
        transfers: active.filter((item) => (
          !!item.transfer_type && !!item.start_date && item.start_date >= date && item.start_date <= addDays(date, 3)
        )),
        upcoming: sortForView(upcoming, 'upcoming').slice(0, 30),
        stale: sortForView(filterByView(items, 'stale', date), 'stale'),
        exceptions: sortForView(filterByView(items, 'exceptions', date), 'exceptions'),
        recent_activity: await loadActivity(supabase, { limit: 25 }),
      },
    })
  } catch (error) {
    console.error('ops today error:', error)
    return NextResponse.json(
      { error: 'Failed to load operations', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}
