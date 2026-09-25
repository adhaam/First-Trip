import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSiteSettings } from '@/lib/data'
import { generateInvoiceHTML } from '@/lib/invoice-generator'
import { buildInvoiceData, type InvoiceSource } from '@/lib/invoice-items'

// ─── Invoice generation ───
//
// Line items are built from the booking's OWN type and columns, not from a
// generic fallback. The previous version derived everything from
// price_snapshot and, when that was absent (every manually-entered booking,
// because the admin route never built one), emitted a single line labelled
// "Accommodation" with qty = num_people. A 5-person transfer-only booking
// therefore printed as an accommodation charge for a hotel it had none of.
//
// Two rules hold here:
//   1. A booking is described by its booking_type. A transfer-only invoice
//      never names an accommodation; an accommodation-only one never invents
//      a transfer.
//   2. The frozen snapshot is the base truth for the lines; the displayed
//      total is the booking's live agreed total, and any gap between the two
//      is an explicit adjustment row. A row with no snapshot gets one honest
//      line for its stored total. See lib/invoice-items for the details.

const invoiceRequestSchema = z.object({
  bookingId: z.string().uuid(),
  bookingType: z.enum(['accommodation', 'trip']),
  type: z.enum(['request', 'confirmation']),
  locale: z.enum(['ar', 'en']),
})

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const validated = invoiceRequestSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
  }
  const { bookingId, bookingType, type, locale } = validated.data

  const supabase = getSupabaseAdmin()

  // Only names are embedded from accommodations / sinai_trips / trip_packages
  // — never their price columns. Lines come from the booking's own frozen
  // snapshot (see lib/invoice-items), so a catalogue price change cannot
  // rewrite an invoice for a booking already made.
  let source: InvoiceSource
  if (bookingType === 'accommodation') {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, customers(name, phone, whatsapp_phone), accommodations(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    source = { kind: 'accommodation', booking }
  } else {
    const { data: tripBooking, error: tripBookingError } = await supabase
      .from('trip_bookings')
      .select('*, customers(name, phone, whatsapp_phone, email), sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (tripBookingError || !tripBooking) {
      return NextResponse.json({ error: 'Trip booking not found' }, { status: 404 })
    }
    source = { kind: 'trip', booking: tripBooking }
  }

  const settings = await getSiteSettings()
  // Pure function of the row: stable invoice number, lines that reconcile to
  // the total, every dynamic value escaped by the generator.
  const invoice = buildInvoiceData(source, { type, locale, settings })
  const invoiceNumber = invoice.invoiceNumber
  const html = generateInvoiceHTML(invoice)

  return NextResponse.json(
    {
      success: true,
      html,
      invoiceNumber,
      fileName: `WEEMAP-Invoice-${invoiceNumber}.html`,
    },
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )
}
