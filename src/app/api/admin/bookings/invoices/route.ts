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
    .select('*, accommodations(name_ar, name_en)')
    .eq('id', validated.data.bookingId)
    .single()

  if (bookingError || !booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const settings = await getSiteSettings()
  const isAr = validated.data.locale === 'ar'
  const now = new Date()
  const invoiceNumber = `BK-${validated.data.bookingId.slice(0, 8).toUpperCase()}-${validated.data.type === 'request' ? 'REQ' : 'CONF'}-${now.getTime().toString().slice(-6)}`

  // Build line items based on booking type
  const items: Array<{ description_ar: string; description_en: string; quantity: number; unitPrice: number }> = []
  const accomName = booking.accommodations
    ? { ar: booking.accommodations.name_ar, en: booking.accommodations.name_en }
    : null

  const bookingType = booking.booking_type as string
  const numPeople = booking.num_people || 1
  const totalPrice = booking.total_price || 0

  if (bookingType === 'package') {
    const duration = booking.duration || 4
    items.push({
      description_ar: `باكدج ${duration} أيام${accomName ? ` — ${accomName.ar}` : ''}`,
      description_en: `${duration}-day Package${accomName ? ` — ${accomName.en}` : ''}`,
      quantity: numPeople,
      unitPrice: numPeople > 0 ? totalPrice / numPeople : totalPrice,
    })
  } else if (bookingType === 'accommodation-only') {
    const nights = booking.nights || 1
    items.push({
      description_ar: `إقامة ${nights} ليالي${accomName ? ` — ${accomName.ar}` : ''}`,
      description_en: `${nights}-night Stay${accomName ? ` — ${accomName.en}` : ''}`,
      quantity: numPeople,
      unitPrice: numPeople > 0 ? totalPrice / numPeople : totalPrice,
    })
  } else if (bookingType === 'transfer-only') {
    const transferType = booking.transfer_type === 'hiace' ? { ar: 'هايس خاص', en: 'Private Hiace' } : { ar: 'باص', en: 'Package Bus' }
    const dirLabels: Record<string, { ar: string; en: string }> = {
      to_dahab: { ar: 'إلى دهب', en: 'To Dahab' },
      from_dahab: { ar: 'من دهب', en: 'From Dahab' },
      round_trip: { ar: 'ذهاب وعودة', en: 'Round Trip' },
    }
    const dir = dirLabels[booking.transfer_direction as string] || { ar: 'نقل', en: 'Transfer' }
    items.push({
      description_ar: `${transferType.ar} — ${dir.ar}`,
      description_en: `${transferType.en} — ${dir.en}`,
      quantity: numPeople,
      unitPrice: numPeople > 0 ? totalPrice / numPeople : totalPrice,
    })
  } else {
    // fallback
    items.push({
      description_ar: 'حجز',
      description_en: 'Booking',
      quantity: numPeople,
      unitPrice: numPeople > 0 ? totalPrice / numPeople : totalPrice,
    })
  }

  // Compute discount
  const subtotal = totalPrice
  let discountAmount = 0
  if (booking.discount_value && booking.discount_type) {
    if (booking.discount_type === 'percentage') {
      discountAmount = subtotal * (booking.discount_value / 100)
    } else {
      discountAmount = booking.discount_value
    }
  }
  const finalTotal = subtotal - discountAmount

  const html = generateInvoiceHTML({
    type: validated.data.type,
    invoiceNumber,
    customerName: booking.customer_name || 'Customer',
    customerPhone: booking.customer_phone || '',
    customerEmail: booking.customer_email || undefined,
    orderDate: new Date(booking.created_at).toLocaleDateString(isAr ? 'ar-EG' : 'en-US'),
    items,
    subtotal,
    discountAmount: discountAmount > 0 ? discountAmount : undefined,
    discountLabel: booking.discount_value
      ? (booking.discount_type === 'percentage' ? `${booking.discount_value}%` : `${booking.discount_value} EGP`)
      : undefined,
    deliveryFee: undefined,
    depositAmount: validated.data.type === 'confirmation' ? (booking.amount_paid || finalTotal * 0.5) : undefined,
    totalAmount: finalTotal,
    paymentChannel: booking.payment_channel || undefined,
    paymentReceivedBy: booking.payment_received_by || undefined,
    notes: booking.notes || undefined,
    locale: validated.data.locale,
    settings,
  })

  return NextResponse.json({
    success: true,
    html,
    invoiceNumber,
    fileName: `WEEMAP-Invoice-${invoiceNumber}.html`,
  })
}
