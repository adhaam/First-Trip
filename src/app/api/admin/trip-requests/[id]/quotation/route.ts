import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { loadRequestJourney } from '@/lib/ops/server'
import {
  generateQuotationHTML,
  quotationLines,
  type QuotationName,
} from '@/lib/quotation-document'
import { getSupabaseAdmin } from '@/lib/supabase'
import type { PriceSnapshot } from '@/lib/types'
import {
  isAvailabilityConfirmedStatus,
  journeyFromRow,
  revisionQuerySchema,
  type JourneyRow,
} from '@/lib/trip-requests/amend'
import {
  amendErrorResponse,
  invalidInputResponse,
  isAmendError,
  loadAmendableRow,
  loadRevisionViews,
} from '@/lib/trip-requests/amend.server'

// The customer-facing quotation for one revision of a journey (latest by default), as standalone,
// printable HTML. It is a quotation, never an invoice, and is marked PROVISIONAL until supplier
// availability is confirmed.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid id', code: 'invalid' }, { status: 400 })
  }
  const query = revisionQuerySchema.safeParse({
    revision: req.nextUrl.searchParams.get('revision') || undefined,
    locale: req.nextUrl.searchParams.get('locale') || undefined,
  })
  if (!query.success) {
    return invalidInputResponse(query.error, 'Invalid query')
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const loaded = await loadAmendableRow(supabase, id)
  if (isAmendError(loaded)) return amendErrorResponse(loaded)
  const { row } = loaded
  const views = await loadRevisionViews(supabase, row)
  if (isAmendError(views)) return amendErrorResponse(views)

  const view = query.data.revision
    ? views.find((candidate) => candidate.revision_number === query.data.revision)
    : views.find((candidate) => candidate.is_current)
  if (!view || !view.quote_snapshot) {
    return NextResponse.json({ error: 'Revision not found', code: 'not_found' }, { status: 404 })
  }

  const journeyFields = journeyFromRow(view.journey as JourneyRow)
  const departure = journeyFields.departure_date ?? row.departure_date ?? journeyFields.arrival_date
  const snapshot = view.quote_snapshot as unknown as PriceSnapshot
  const total = view.quoted_total ?? snapshot.total

  // Names are labels only; every amount comes from the revision's frozen snapshot.
  const record = { ...journeyFields, quote_snapshot: snapshot, payment_plan: view.payment_plan, quoted_total: total }
  const accommodationId = journeyFields.accommodation_id
  const [lookups, accommodation] = await Promise.all([
    loadRequestJourney(supabase, record),
    accommodationId
      ? supabase.from('accommodations').select('name_ar, name_en').eq('id', accommodationId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const tripNames: Record<string, QuotationName> = {}
  const packageNames: Record<string, QuotationName> = {}
  for (const experience of lookups.experiences) {
    const target = experience.kind === 'trip' ? tripNames : packageNames
    target[experience.id] = { name_ar: experience.name_ar, name_en: experience.name_en }
  }
  const stay = accommodation.data as QuotationName | null

  const html = generateQuotationHTML({
    reference: row.reference,
    revision_number: view.revision_number,
    is_current: view.is_current,
    superseded_by: view.superseded_by,
    status: row.status,
    availability_confirmed: view.is_current ? isAvailabilityConfirmedStatus(row.status) : view.availability_confirmed,
    created_at: view.created_at,
    customer_name: row.customer_name,
    journey: {
      arrival_date: journeyFields.arrival_date,
      departure_date: departure,
      nights: snapshot.nights ?? null,
      adults: journeyFields.adults,
      children: journeyFields.children,
      transport_mode: journeyFields.transport_mode,
      origin: lookups.origin,
      stay: stay ? { name_ar: stay.name_ar, name_en: stay.name_en } : null,
      rooms: (journeyFields.room_allocations ?? []).map((room) => ({ type: room.type, count: room.count })),
      meal_plan: lookups.meal_plan,
      experiences: lookups.experiences.map((item) => ({ name_ar: item.name_ar, name_en: item.name_en })),
    },
    lines: quotationLines({ ...snapshot, total }, { trips: tripNames, packages: packageNames }),
    total,
    previous_total: view.previous_total,
    difference: view.difference,
    payment_plan: view.payment_plan,
    locale: query.data.locale,
  })

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
    },
  })
}
