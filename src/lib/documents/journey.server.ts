import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadRequestJourney } from '@/lib/ops/server'
import {
  quotationLines, type QuotationJourney, type QuotationLine, type QuotationName,
} from '@/lib/quotation-document'
import { journeyFromRow, type JourneyRow } from '@/lib/trip-requests/amend'
import type { RevisionView } from '@/lib/trip-requests/revisions'
import type { PriceSnapshot } from '@/lib/types'

/**
 * The journey facts and price lines of one revision of a trip request, ready
 * for the quotation and the booking-confirmation documents. Names are labels
 * only; every amount comes from the revision's frozen snapshot, reconciled to
 * `total` (a gap becomes an explicit adjustment line, never a silent difference).
 */
export async function loadJourneyDocumentFacts(
  supabase: SupabaseClient,
  view: RevisionView,
  fallbackDeparture: string | null | undefined,
  total: number,
): Promise<{ journey: QuotationJourney; lines: QuotationLine[] }> {
  const journeyFields = journeyFromRow(view.journey as JourneyRow)
  const departure = journeyFields.departure_date ?? fallbackDeparture ?? journeyFields.arrival_date
  const snapshot = (view.quote_snapshot ?? null) as unknown as PriceSnapshot | null

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

  let lines = quotationLines(snapshot ? { ...snapshot, total } : null, { trips: tripNames, packages: packageNames })
  if (lines.length === 0 && total > 0) {
    // No usable snapshot: one honest line carrying the agreed total rather than an empty table.
    lines = [{ key: 'journey', label_en: 'Your journey', label_ar: 'رحلتك', amount: total }]
  }

  return {
    journey: {
      arrival_date: journeyFields.arrival_date,
      departure_date: departure,
      nights: snapshot?.nights ?? null,
      adults: journeyFields.adults,
      children: journeyFields.children,
      transport_mode: journeyFields.transport_mode,
      origin: lookups.origin,
      stay: stay ? { name_ar: stay.name_ar, name_en: stay.name_en } : null,
      rooms: (journeyFields.room_allocations ?? []).map((room) => ({ type: room.type, count: room.count })),
      meal_plan: lookups.meal_plan,
      experiences: lookups.experiences.map((item) => ({ name_ar: item.name_ar, name_en: item.name_en })),
    },
    lines,
  }
}
