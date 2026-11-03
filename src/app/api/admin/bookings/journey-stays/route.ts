import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { toJourneyStayRows, type JourneyStayComponent, type JourneyStayRequest } from '@/lib/ops/journey-stays'

// Build Your Trip journeys that include accommodation — requested (awaiting conversion) or converted —
// for the Bookings → Stays view. Read-only: it never creates a booking, and a converted journey's hotel
// booking is returned only as a link to that component, so nothing is counted or payable twice.
export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)

  const { data: requests, error } = await supabase
    .from('trip_requests')
    .select('id, reference, status, customer_name, customer_phone, accommodation_id, arrival_date, departure_date, adults, children, submitted_at, created_at, converted_booking_id, converted_at')
    .not('accommodation_id', 'is', null)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(500)
  if (error) {
    console.error('GET journey stays error:', error)
    return NextResponse.json({ error: 'Failed to load journey stays' }, { status: 500 })
  }

  const ids = (requests ?? []).map((r) => r.id)
  let components: JourneyStayComponent[] = []
  if (ids.length) {
    const { data, error: componentError } = await supabase
      .from('bookings')
      .select('id, trip_request_id, status')
      .in('trip_request_id', ids)
    if (componentError) {
      console.error('GET journey stay components error:', componentError)
      return NextResponse.json({ error: 'Failed to load journey stays' }, { status: 500 })
    }
    components = (data ?? []) as JourneyStayComponent[]
  }

  return NextResponse.json({ journeys: toJourneyStayRows((requests ?? []) as JourneyStayRequest[], components) })
}
