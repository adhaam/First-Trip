/**
 * Build Your Trip journeys that include accommodation, for the Bookings → Stays view.
 *
 * A hotel requested through Build Your Trip lives on a trip_requests row (WR-…). Until staff
 * convert it there is NO bookings row at all, and once converted its bookings row is a journey
 * component — both are deliberately absent from the legacy stays list (the component's money and
 * documents belong to the journey). This module turns those journeys into a read-only list so a
 * hotel request is always findable from Stays, clearly marked as requested vs converted, without
 * creating or duplicating any booking, payment obligation or work item.
 */

export type JourneyStayState = 'requested' | 'converted' | 'cancelled'

export type JourneyStayRequest = {
  id: string
  reference: string
  status: string
  customer_name: string | null
  customer_phone: string | null
  accommodation_id: string | null
  arrival_date: string | null
  departure_date: string | null
  adults: number | null
  children: number | null
  submitted_at: string | null
  created_at: string
  converted_booking_id: string | null
  converted_at: string | null
}

export type JourneyStayComponent = { id: string; trip_request_id: string; status: string }

export type JourneyStayRow = {
  request_id: string
  reference: string
  state: JourneyStayState
  status: string
  customer_name: string
  customer_phone: string
  accommodation_id: string
  arrival_date: string | null
  departure_date: string | null
  people: number
  /** When the customer submitted the request — the "newest first" key. */
  created_at: string
  /** The converted hotel/transport booking (BK-…), when there is one. */
  component: { id: string; reference: string; status: string } | null
}

export function bookingReference(id: string): string {
  return `BK-${id.slice(0, 8).toUpperCase()}`
}

/**
 * Only journeys that actually carry accommodation; a converted one is shown with its component,
 * never as a second "requested" row. Newest submission first, id as a stable tiebreak.
 */
export function toJourneyStayRows(requests: JourneyStayRequest[], components: JourneyStayComponent[]): JourneyStayRow[] {
  const componentByRequest = new Map(components.map((c) => [c.trip_request_id, c]))
  return requests
    .filter((r): r is JourneyStayRequest & { accommodation_id: string } => Boolean(r.accommodation_id))
    .map((r) => {
      const component = componentByRequest.get(r.id) ?? null
      const converted = Boolean(r.converted_booking_id || r.converted_at || component)
      const state: JourneyStayState = r.status === 'cancelled' ? 'cancelled' : converted ? 'converted' : 'requested'
      return {
        request_id: r.id,
        reference: r.reference,
        state,
        status: r.status,
        customer_name: r.customer_name ?? '',
        customer_phone: r.customer_phone ?? '',
        accommodation_id: r.accommodation_id,
        arrival_date: r.arrival_date,
        departure_date: r.departure_date,
        people: (r.adults ?? 0) + (r.children ?? 0),
        created_at: r.submitted_at ?? r.created_at,
        component: component ? { id: component.id, reference: bookingReference(component.id), status: component.status } : null,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.request_id.localeCompare(a.request_id))
}

/** Free-text match on reference (WR- or BK-), customer name/phone and hotel name. */
export function matchesJourneyStaySearch(row: JourneyStayRow, query: string, hotelName: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [row.reference, row.component?.reference ?? '', row.customer_name, row.customer_phone, hotelName]
    .some((value) => value.toLowerCase().includes(q))
}
