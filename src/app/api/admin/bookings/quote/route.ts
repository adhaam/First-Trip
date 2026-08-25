import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { bookingQuoteSchema, priceBooking } from '@/lib/booking-pricing'

/**
 * Auto-price preview for the admin "manual booking" form — reuses the exact
 * same pricing engine as the public booking route (src/lib/booking-pricing.ts)
 * so the dashboard never guesses a number that diverges from what the site
 * would actually charge. The admin can still edit the resulting total_price
 * by hand afterwards; this just fills in a correct starting point.
 */
export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = bookingQuoteSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  try {
    const result = await priceBooking(validated.data)
    return NextResponse.json(result)
  } catch (err) {
    console.error('Admin quote error:', err)
    return NextResponse.json({ error: 'Failed to calculate price' }, { status: 500 })
  }
}
