import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSiteSettings } from '@/lib/data'
import { generateInvoiceHTML, type InvoiceData, type InvoiceDetail } from '@/lib/invoice-generator'
import { buildAccommodationInvoice, buildTripInvoice } from '@/lib/invoice-items'
import type { Booking } from '@/lib/types'

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
//   2. The snapshot is preferred when present (it is the frozen truth), but
//      its absence degrades to the booking's own columns rather than to a
//      misleading placeholder. Old rows still produce a correct invoice.

const invoiceRequestSchema = z.object({
  bookingId: z.string().uuid(),
  bookingType: z.enum(['accommodation', 'trip']),
  type: z.enum(['request', 'confirmation']),
  locale: z.enum(['ar', 'en']),
})

type InvoiceItem = InvoiceData['items'][number]

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

  let customerName = 'Customer'
  let customerPhone = ''
  let customerEmail: string | undefined
  let createdAt: string
  let items: InvoiceItem[]
  let details: InvoiceDetail[]
  let totalAmount: number
  let amountPaid = 0
  let discount: InvoiceData['discount']
  let notes: string | undefined
  let invoicePrefix: string

  if (bookingType === 'accommodation') {
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, customers(name, phone, whatsapp_phone), accommodations(name_ar, name_en)')
      .eq('id', bookingId)
      .single<Booking & {
        customers: { name: string; phone: string; whatsapp_phone: string } | null
        accommodations: { name_ar: string; name_en: string } | null
      }>()

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const built = buildAccommodationInvoice(booking, locale)
    items = built.items
    details = built.details
    discount = built.discount

    customerName = booking.customers?.name || booking.customer_name || 'Customer'
    customerPhone = booking.customers?.phone || booking.customer_phone || ''
    customerEmail = booking.customer_email || undefined
    createdAt = booking.created_at
    totalAmount = booking.total_price || 0
    amountPaid = Number(booking.amount_paid) || 0
    notes = booking.notes || undefined
    invoicePrefix = 'BK'
  } else {
    const { data: tripBooking, error: tripBookingError } = await supabase
      .from('trip_bookings')
      .select('*, customers(name, phone, whatsapp_phone, email), sinai_trips(name_ar, name_en), trip_packages(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (tripBookingError || !tripBooking) {
      return NextResponse.json({ error: 'Trip booking not found' }, { status: 404 })
    }

    const built = buildTripInvoice(tripBooking, locale)
    items = built.items
    details = built.details
    discount = built.discount

    customerName = tripBooking.customers?.name || tripBooking.customer_name || 'Customer'
    customerPhone = tripBooking.customers?.phone || tripBooking.customer_phone || ''
    customerEmail = tripBooking.customers?.email || undefined
    createdAt = tripBooking.created_at
    totalAmount = tripBooking.final_price ?? tripBooking.quoted_price ?? 0
    // trip_bookings tracks payments too, so a trip invoice gets the same
    // paid / balance-due rows as an accommodation one.
    amountPaid = Number(tripBooking.amount_paid) || 0
    notes = tripBooking.notes || undefined
    invoicePrefix = 'TB'
  }

  const settings = await getSiteSettings()
  const now = new Date()
  const invoiceNumber = `${invoicePrefix}-${bookingId.slice(0, 8).toUpperCase()}-${type === 'request' ? 'REQ' : 'CONF'}-${now.getTime().toString().slice(-6)}`
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)

  const html = generateInvoiceHTML({
    type,
    invoiceNumber,
    customerName,
    customerPhone,
    customerEmail,
    orderDate: new Date(createdAt).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US'),
    details,
    items,
    subtotal,
    deliveryFee: undefined,
    discount,
    // The deposit row now reflects money actually received rather than a
    // blanket 50% of the total, which was shown even on unpaid bookings.
    depositAmount: undefined,
    amountPaid,
    totalAmount,
    notes,
    locale,
    settings,
  })

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
