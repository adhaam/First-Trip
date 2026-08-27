import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createCommerceOrder } from '@/lib/orders'
import { verifyTurnstile } from '@/lib/turnstile'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5
const RATE_WINDOW = 60 * 60 * 1000

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || entry.resetAt < now) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count += 1
  return true
}

const orderSchema = z.object({
  customer_name: z.string().min(3).max(100),
  customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  fulfillment_method: z.enum(['pickup', 'delivery']),
  delivery_zone_id: z.string().uuid().optional(),
  delivery_address: z.string().max(300).optional(),
  notes: z.string().max(500).optional(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    variant_id: z.string().uuid().optional(),
    quantity: z.number().int().min(1).max(50),
    rental_duration_days: z.number().int().min(1).optional(),
    rental_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })).min(1).max(20),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
})

/**
 * Public entry point for merch + rental requests. Guest-first (no account,
 * no password) — identity resolves from the phone number via the shared
 * customer resolver. Every price is recomputed server-side by
 * createCommerceOrder(); nothing the client sends as a price is trusted.
 */
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json().catch(() => null)

    if (body && typeof body === 'object' && 'website' in body && body.website) {
      return NextResponse.json({ success: true, orderId: null, orderNumber: null, totalPrice: 0 }, { status: 201 })
    }

    const validated = orderSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      const humanVerified = await verifyTurnstile(validated.data.turnstile_token ?? null)
      if (!humanVerified) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }
    }

    const result = await createCommerceOrder({
      customerName: validated.data.customer_name,
      customerPhone: validated.data.customer_phone,
      customerEmail: validated.data.customer_email || null,
      fulfillmentMethod: validated.data.fulfillment_method,
      deliveryZoneId: validated.data.delivery_zone_id || null,
      deliveryAddress: validated.data.delivery_address || null,
      notes: validated.data.notes,
      source: 'website',
      items: validated.data.items.map((i) => ({
        productId: i.product_id,
        variantId: i.variant_id || null,
        quantity: i.quantity,
        rentalDurationDays: i.rental_duration_days,
        rentalStartDate: i.rental_start_date,
      })),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      { success: true, orderId: result.orderId, orderNumber: result.orderNumber, totalPrice: result.totalPrice },
      { status: 201 },
    )
  } catch (err) {
    console.error('Commerce order API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
