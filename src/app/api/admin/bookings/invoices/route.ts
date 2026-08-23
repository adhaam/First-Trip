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
    .from('commerce_orders')
    .select('*, customers(name, phone, whatsapp_phone), commerce_order_items(*), delivery_zones(name_ar, name_en)')
    .eq('id', validated.data.bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const settings = await getSiteSettings()
  const isAr = validated.data.locale === 'ar'
  const now = new Date()
  const invoiceNumber = `${booking.order_number}-${validated.data.type === 'request' ? 'REQ' : 'CONF'}-${now.getTime().toString().slice(-6)}`

  const items = (booking.commerce_order_items || []).map((item: any) => ({
    description_ar: item.name_snapshot_ar,
    description_en: item.name_snapshot_en,
    quantity: item.quantity,
    unitPrice: item.unit_price,
  }))

  const html = generateInvoiceHTML({
    type: validated.data.type,
    invoiceNumber,
    customerName: booking.customers?.name || 'Customer',
    customerPhone: booking.customers?.phone || '',
    customerEmail: undefined,
    orderDate: new Date(booking.created_at).toLocaleDateString(validated.data.locale === 'ar' ? 'ar-EG' : 'en-US'),
    items,
    subtotal: booking.subtotal || 0,
    deliveryFee: booking.delivery_fee || 0,
    depositAmount: validated.data.type === 'confirmation' ? booking.total_price * 0.5 : undefined,
    totalAmount: booking.total_price || 0,
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
