import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

// Rate limiting (simple in-memory store — for production use Upstash Redis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 5 // max 5 bookings
const RATE_WINDOW = 60 * 60 * 1000 // 1 hour

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

const bookingSchema = z.object({
  customer_name: z.string().min(3).max(100),
  customer_phone: z.string().min(10).max(20),
  customer_email: z.string().email().optional().or(z.literal('')),
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  accommodation_id: z.string().uuid().optional(),
  governorate: z.string().optional(),
  trip_date: z.string().optional(),
  duration: z.number().int().optional(),
  num_people: z.number().int().min(1).max(50),
  notes: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    // Rate limit by IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(ip)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    const body = await req.json()
    const validated = bookingSchema.safeParse(body)

    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // Insert booking
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...validated.data,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Supabase error:', error)
      return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
    }

    // Upsert customer
    await supabase.from('customers').upsert({
      name: validated.data.customer_name,
      phone: validated.data.customer_phone,
      email: validated.data.customer_email || null,
    }, {
      onConflict: 'phone',
      ignoreDuplicates: false,
    })

    // TODO: Send WhatsApp notification to admin
    // TODO: Send confirmation email to customer

    return NextResponse.json({ success: true, booking: data }, { status: 201 })
  } catch (err) {
    console.error('Booking API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}