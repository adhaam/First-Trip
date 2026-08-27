import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { verifyTurnstile } from '@/lib/turnstile'
import { getTripPackagesForPricing } from '@/lib/trip-packages'

// Simple in-memory rate limit, consistent with /api/bookings.
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

const tripBookingSchema = z.object({
  trip_id: z.string().uuid().optional(),
  trip_package_id: z.string().uuid().optional(),
  customer_name: z.string().min(3).max(100),
  customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  num_people: z.number().int().min(1).max(50),
  adults: z.number().int().min(0).max(50).optional(),
  children: z.number().int().min(0).max(50).optional(),
  selected_options: z.record(z.string(), z.unknown()).optional().default({}),
  notes: z.string().max(500).optional(),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
}).refine((d) => Boolean(d.trip_id) !== Boolean(d.trip_package_id), {
  message: 'Provide exactly one of trip_id or trip_package_id',
})

/**
 * Public endpoint for a standalone Sinai Trip request (not bundled into an
 * accommodation package booking). WhatsApp-first: this creates a "new"
 * request for WEEMAP staff to confirm — no online payment.
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
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const validated = tripBookingSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      const humanVerified = await verifyTurnstile(validated.data.turnstile_token ?? null)
      if (!humanVerified) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()

    const insertBase = {
      customer_name: validated.data.customer_name,
      customer_phone: validated.data.customer_phone,
      preferred_date: validated.data.preferred_date || null,
      num_people: validated.data.num_people,
      adults: validated.data.adults ?? null,
      children: validated.data.children ?? null,
      selected_options: validated.data.selected_options || {},
      notes: validated.data.notes || '',
      source: 'website',
      status: 'new',
    }

    let insertRow: Record<string, unknown>

    if (validated.data.trip_package_id) {
      // Package booking — server recomputes the authoritative total from
      // trusted DB values and freezes it into package_snapshot at request
      // time. Never trust a client-sent total.
      const [pkg] = await getTripPackagesForPricing([validated.data.trip_package_id])
      if (!pkg || !pkg.totals?.isValid) {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }
      const quotedPrice = pkg.totals.packageTotal * validated.data.num_people
      insertRow = {
        ...insertBase,
        trip_id: null,
        trip_package_id: pkg.id,
        context: 'package',
        quoted_price: quotedPrice,
        package_snapshot: {
          name_ar: pkg.name_ar,
          name_en: pkg.name_en,
          package_total: pkg.totals.packageTotal,
          public_total: pkg.totals.publicTotal,
          savings: pkg.totals.savings,
          trips: (pkg.trips || []).map((t) => ({
            id: t.id,
            name_ar: t.name_ar,
            name_en: t.name_en,
            price: t.price,
            package_price: t.package_price,
          })),
        },
      }
    } else {
      const { data: trip } = await supabase
        .from('sinai_trips')
        .select('id, price, is_active')
        .eq('id', validated.data.trip_id)
        .maybeSingle()
      if (!trip || !trip.is_active) {
        return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
      }

      // Quoted price is always server-derived — never trusted from the client.
      const quotedPrice = Number(trip.price) * validated.data.num_people
      insertRow = {
        ...insertBase,
        trip_id: validated.data.trip_id,
        context: 'standalone',
        quoted_price: quotedPrice,
      }
    }

    const customer = await findOrCreateCustomerByPhone({
      phone: validated.data.customer_phone,
      name: validated.data.customer_name,
      email: validated.data.customer_email || null,
    })

    const { data, error } = await supabase
      .from('trip_bookings')
      .insert({ ...insertRow, customer_id: customer.id })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create trip booking' }, { status: 500 })
    }

    await recordCustomerActivity(customer.id)

    return NextResponse.json({ success: true, tripBooking: data }, { status: 201 })
  } catch (err) {
    console.error('Trip booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
