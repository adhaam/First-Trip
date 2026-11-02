import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSiteSettings } from '@/lib/data'
import { buildJourneyConfirmation } from '@/lib/documents/journey-confirmation'
import { loadJourneyDocumentFacts } from '@/lib/documents/journey.server'
import { documentHtmlResponse, documentJson } from '@/lib/documents/response'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { getSupabaseAdmin } from '@/lib/supabase'
import { currentTotal, isAvailabilityConfirmedStatus } from '@/lib/trip-requests/amend'
import {
  amendErrorResponse,
  isAmendError,
  loadAmendableRow,
  loadRevisionViews,
} from '@/lib/trip-requests/amend.server'

// The Booking Confirmation & Payment Request for a journey's CURRENT state, as standalone, printable
// HTML. It exists only once supplier availability is confirmed (awaiting_payment / confirmed /
// completed); before that the customer document is the Provisional Quotation (../quotation).
// What is required now / later comes from the journey's payment plan (journeyPaymentKind) less the
// amount the ledger has received — it never claims money beyond that figure.
const querySchema = z.object({ locale: z.enum(['ar', 'en']).default('en') })

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) {
    return documentJson({ error: 'Invalid id', code: 'invalid' }, 400)
  }
  const query = querySchema.safeParse({ locale: req.nextUrl.searchParams.get('locale') || undefined })
  if (!query.success) {
    return documentJson({ error: 'Invalid query', code: 'invalid', details: query.error.flatten() }, 400)
  }

  const supabase = getSupabaseAdmin(gate.staff)
  const loaded = await loadAmendableRow(supabase, id)
  if (isAmendError(loaded)) return amendErrorResponse(loaded)
  const { row } = loaded
  if (!isAvailabilityConfirmedStatus(row.status)) {
    return documentJson({ error: 'availability_not_confirmed', code: 'availability_not_confirmed' }, 409)
  }
  const views = await loadRevisionViews(supabase, row)
  if (isAmendError(views)) return amendErrorResponse(views)
  const view = views.find((candidate) => candidate.is_current)
  if (!view) return documentJson({ error: 'Revision not found', code: 'not_found' }, 404)

  const total = currentTotal(row)
  const contactRow = row as typeof row & {
    customer_phone?: string | null
    customer_email?: string | null
  }
  const [facts, settings, rules] = await Promise.all([
    loadJourneyDocumentFacts(supabase, view, row.departure_date, total),
    getSiteSettings(),
    getPaymentRules(),
  ])

  const result = buildJourneyConfirmation({
    reference: row.reference,
    status: row.status,
    customer_name: row.customer_name,
    customer_phone: contactRow.customer_phone,
    customer_email: contactRow.customer_email,
    revision_number: view.revision_number,
    journey_row: row,
    journey: facts.journey,
    lines: facts.lines,
    total,
    amount_paid: Number(row.amount_paid) || 0,
    policies: rules.policies,
    payment_methods: rules.methods,
    settings,
    locale: query.data.locale,
  })
  if (!result.ok) return documentJson({ error: result.code, code: result.code }, 409)
  return documentHtmlResponse(result.html)
}
