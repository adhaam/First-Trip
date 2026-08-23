import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getSiteSettings } from '@/lib/data'
import { generateInvoiceHTML } from '@/lib/invoice-generator'

const invoiceRequestSchema = z.object({
  bookingId: z.string().uuid(),
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

  const supabase = getSupabaseAdmin()
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, customers(name, phone, whatsapp_phone), sinai_trips(name_ar, name_en)')
    .eq('id', validated.data.bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const settings = await getSiteSettings()
  const isAr = validated.data.locale === 'ar'
  const now = new Date()
  const invoiceNumber = `BK-${validated.data.bookingId.slice(0, 8).toUpperCase()}-${validated.data.type === 'request' ? 'REQ' : 'CONF'}-${now.getTime().toString().slice(-6)}`

  const items = [{
    description_ar: booking.sinai_trips?.name_ar || 'رحلة سيناء',
    description_en: booking.sinai_trips?.name_en || 'Sinai Trip',
    quantity: booking.number_of_participants || 1,
    unitPrice: booking.price_per_person || 0,
  }]

  const html = generateInvoiceHTML({
    type: validated.data.type,
    invoiceNumber,
    customerName: booking.customers?.name || 'Customer',
    customerPhone: booking.customers?.phone || '',
    customerEmail: undefined,
    orderDate: new Date(booking.created_at).toLocaleDateString(validated.data.locale === 'ar' ? 'ar-EG' : 'en-US'),
    items,
    subtotal: (booking.price_per_person || 0) * (booking.number_of_participants || 1),
    deliveryFee: undefined,
    depositAmount: validated.data.type === 'confirmation' ? (booking.total_amount || 0) * 0.5 : undefined,
    totalAmount: booking.total_amount || 0,
    notes: booking.notes || undefined,
    locale: validated.data.locale,
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
