import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSiteSettings } from '@/lib/data'
import { generateInvoiceHTML, type InvoiceData } from '@/lib/invoice-generator'
import type { Booking } from '@/lib/types'

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
  let totalAmount: number
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

    const snapshot = booking.price_snapshot
    const accommodationNameAr = booking.accommodations?.name_ar || 'إقامة'
    const accommodationNameEn = booking.accommodations?.name_en || 'Accommodation'

    items = []
    if (snapshot?.accommodation_subtotal) {
      const nights = snapshot.nights || booking.nights || 1
      items.push({
        description_ar: `${accommodationNameAr} (${nights} ${nights === 1 ? 'ليلة' : 'ليالي'})`,
        description_en: `${accommodationNameEn} (${nights} night${nights === 1 ? '' : 's'})`,
        quantity: 1,
        unitPrice: snapshot.accommodation_subtotal,
      })
    }
    if (snapshot?.transfer_subtotal) {
      items.push({
        description_ar: 'النقل',
        description_en: 'Transfer',
        quantity: 1,
        unitPrice: snapshot.transfer_subtotal,
      })
    }
    if (snapshot?.meal_subtotal) {
      items.push({
        description_ar: 'خطة الوجبات',
        description_en: 'Meal Plan',
        quantity: 1,
        unitPrice: snapshot.meal_subtotal,
      })
    }
    if (snapshot?.included_trips_subtotal) {
      items.push({
        description_ar: 'الرحلات المضمنة',
        description_en: 'Included Trips',
        quantity: 1,
        unitPrice: snapshot.included_trips_subtotal,
      })
    }
    if (snapshot?.extra_trips_subtotal) {
      items.push({
        description_ar: 'رحلات إضافية',
        description_en: 'Extra Trips',
        quantity: 1,
        unitPrice: snapshot.extra_trips_subtotal,
      })
    }
    if (snapshot?.trip_packages_subtotal) {
      items.push({
        description_ar: 'باقات الرحلات',
        description_en: 'Trip Packages',
        quantity: 1,
        unitPrice: snapshot.trip_packages_subtotal,
      })
    }
    if (items.length === 0) {
      // No snapshot breakdown available — fall back to a single line from total_price.
      items.push({
        description_ar: accommodationNameAr,
        description_en: accommodationNameEn,
        quantity: booking.num_people || 1,
        unitPrice: booking.num_people ? (booking.total_price || 0) / booking.num_people : (booking.total_price || 0),
      })
    }

    customerName = booking.customers?.name || booking.customer_name || 'Customer'
    customerPhone = booking.customers?.phone || booking.customer_phone || ''
    customerEmail = booking.customer_email || undefined
    createdAt = booking.created_at
    totalAmount = booking.total_price || 0
    notes = booking.notes || undefined
    invoicePrefix = 'BK'
  } else {
    const { data: tripBooking, error: tripBookingError } = await supabase
      .from('trip_bookings')
      .select('*, customers(name, phone, whatsapp_phone, email), sinai_trips(name_ar, name_en)')
      .eq('id', bookingId)
      .single()

    if (tripBookingError || !tripBooking) {
      return NextResponse.json({ error: 'Trip booking not found' }, { status: 404 })
    }

    const tripNameAr = tripBooking.sinai_trips?.name_ar || 'رحلة سيناء'
    const tripNameEn = tripBooking.sinai_trips?.name_en || 'Sinai Trip'
    const price = tripBooking.final_price ?? tripBooking.quoted_price ?? 0
    const numPeople = tripBooking.num_people || 1

    items = [{
      description_ar: tripNameAr,
      description_en: tripNameEn,
      quantity: numPeople,
      unitPrice: numPeople ? price / numPeople : price,
    }]

    customerName = tripBooking.customers?.name || tripBooking.customer_name || 'Customer'
    customerPhone = tripBooking.customers?.phone || tripBooking.customer_phone || ''
    customerEmail = tripBooking.customers?.email || undefined
    createdAt = tripBooking.created_at
    totalAmount = price
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
    items,
    subtotal,
    deliveryFee: undefined,
    depositAmount: type === 'confirmation' ? totalAmount * 0.5 : undefined,
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
