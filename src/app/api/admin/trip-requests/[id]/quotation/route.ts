import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSiteSettings } from '@/lib/data'
import { loadJourneyDocumentFacts } from '@/lib/documents/journey.server'
import { documentHtmlResponse, documentJson } from '@/lib/documents/response'
import { agreedJourneyPaymentKind, paymentPlan } from '@/lib/payment-rules'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { generateQuotationHTML } from '@/lib/quotation-document'
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
// printable HTML on the shared branded template. It is a "Provisional Quotation" until supplier
// availability is confirmed — never a confirmation and never an invoice; once confirmed the
// customer-facing document is the Booking Confirmation & Payment Request (./confirmation).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return documentJson({ error: 'Invalid id', code: 'invalid' }, 400)
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
    return documentJson({ error: 'Revision not found', code: 'not_found' }, 404)
  }

  const snapshot = view.quote_snapshot as unknown as PriceSnapshot
  const total = view.quoted_total ?? snapshot.total
  const journeyFields = journeyFromRow(view.journey as JourneyRow)
  const [facts, settings, rules] = await Promise.all([
    loadJourneyDocumentFacts(supabase, view, row.departure_date, total),
    getSiteSettings(),
    getPaymentRules(),
  ])

  // The current revision shows the payment terms it was quoted with (its stored plan's kind — a
  // journey without accommodation is 100% after confirmation) at today's policy percentages; a
  // superseded revision keeps the terms it was issued with.
  const payment_plan = view.is_current
    ? paymentPlan(agreedJourneyPaymentKind({ ...journeyFields, payment_plan: view.payment_plan }), total, rules.policies)
    : view.payment_plan

  const html = generateQuotationHTML({
    reference: row.reference,
    revision_number: view.revision_number,
    is_current: view.is_current,
    superseded_by: view.superseded_by,
    status: row.status,
    availability_confirmed: view.is_current ? isAvailabilityConfirmedStatus(row.status) : view.availability_confirmed,
    created_at: view.created_at,
    customer_name: row.customer_name,
    journey: facts.journey,
    lines: facts.lines,
    total,
    previous_total: view.previous_total,
    difference: view.difference,
    payment_plan,
    settings,
    locale: query.data.locale,
  })

  return documentHtmlResponse(html)
}
