import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSiteSettings } from '@/lib/data'
import { documentJson } from '@/lib/documents/response'
import { generateInvoiceHTML } from '@/lib/invoice-generator'
import { buildInvoiceData, type InvoiceSource } from '@/lib/invoice-items'
import { getPaymentRules } from '@/lib/payment-rules-load'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isAvailabilityConfirmedStatus } from '@/lib/trip-requests/amend'

// ─── Customer documents for single bookings ───
//
// (The path keeps its historical name; nothing here is an invoice.) Two documents:
//   'provisional_quotation' (alias 'request')       → Provisional Quotation
//   'booking_confirmation'  (alias 'confirmation')  → Booking Confirmation & Payment Request,
//       only once availability is confirmed (awaiting_payment / confirmed / completed).
// A booking that is a component of a journey (trip_request_id set) never gets a document of its
// own — the journey is the sole commercial owner, so its documents come from the trip-request
// routes.
//
// Line items are built from the booking's OWN type and columns, not from a generic fallback, and
// the frozen snapshot is the base truth for the lines; the displayed total is the booking's live
// agreed total with any gap shown as an explicit adjustment row. See lib/invoice-items. What is
// required now / later comes from the booking's stored payment kind (payment_policies) less the
// amount the ledger has received — lib/documents/payment-due.

const documentTypeSchema = z.enum(['request', 'confirmation', 'provisional_quotation', 'booking_confirmation'])

const documentRequestSchema = z.object({
  bookingId: z.string().uuid(),
  bookingType: z.enum(['accommodation', 'trip']),
  type: documentTypeSchema,
  locale: z.enum(['ar', 'en']),
})

export async function POST(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response

  const body = await req.json().catch(() => null)
  const validated = documentRequestSchema.safeParse(body)
  if (!validated.success) {
    return documentJson({ error: 'Invalid data' }, 400)
  }
  const { bookingId, bookingType, locale } = validated.data
  const type = validated.data.type === 'request' || validated.data.type === 'provisional_quotation'
    ? 'request' as const
    : 'confirmation' as const

  const supabase = getSupabaseAdmin(gate.staff)

  // Only names are embedded from accommodations / sinai_trips / trip_packages
  // — never their price columns. Lines come from the booking's own frozen
  // snapshot (see lib/invoice-items), so a catalogue price change cannot
  // rewrite a document for a booking already made.
  let source: InvoiceSource
  let status: string
  let tripRequestId: string | null
  if (bookingType === 'accommodation') {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, customers(name, phone, whatsapp_phone), accommodations(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return documentJson({ error: 'Booking not found' }, 404)
    }
    source = { kind: 'accommodation', booking }
    status = String(booking.status)
    tripRequestId = booking.trip_request_id ?? null
  } else {
    const { data: tripBooking, error: tripBookingError } = await supabase
      .from('trip_bookings')
      .select('*, customers(name, phone, whatsapp_phone, email), sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (tripBookingError || !tripBooking) {
      return documentJson({ error: 'Trip booking not found' }, 404)
    }
    source = { kind: 'trip', booking: tripBooking }
    status = String(tripBooking.status)
    tripRequestId = tripBooking.trip_request_id ?? null
  }

  if (tripRequestId) {
    return documentJson({ error: 'component_of_journey', code: 'component_of_journey' }, 409)
  }
  if (type === 'confirmation' && !isAvailabilityConfirmedStatus(status)) {
    return documentJson({ error: 'availability_not_confirmed', code: 'availability_not_confirmed' }, 409)
  }

  const [settings, rules] = await Promise.all([getSiteSettings(), getPaymentRules()])
  // Pure function of the row: stable document number, lines that reconcile to the total, every
  // dynamic value escaped by the generator.
  const document = buildInvoiceData(source, {
    type,
    locale,
    settings,
    policies: rules.policies,
    paymentMethods: rules.methods,
  })
  const documentNumber = document.invoiceNumber
  const html = generateInvoiceHTML(document)
  const label = type === 'request' ? 'Provisional-Quotation' : 'Booking-Confirmation'

  return documentJson({
    success: true,
    html,
    documentNumber,
    // Same value, kept for callers written against the old response.
    invoiceNumber: documentNumber,
    fileName: `WEEMAP-${label}-${documentNumber}.html`,
  })
}
