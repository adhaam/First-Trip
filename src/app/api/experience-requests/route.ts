import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { findOrCreateCustomerByPhone, recordCustomerActivity } from '@/lib/customer'
import { verifyTurnstile } from '@/lib/turnstile'

// Simple in-memory rate limit, consistent with /api/bookings and /api/trip-bookings.
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

// Covers both a request against a published Experience AND a fully custom
// "Build Your Signature" request — a customer never needs to know an exact
// accommodation/trip/experience_id before submitting.
const requestSchema = z.object({
  experience_id: z.string().uuid().optional(),
  full_name: z.string().min(3).max(100),
  phone: z.string().min(10).max(20),
  email: z.string().email().optional().or(z.literal('')),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  spots_requested: z.number().int().min(1).max(50).optional().default(1),
  interests: z.string().max(500).optional().default(''),
  duration_preference: z.string().max(200).optional().default(''),
  notes: z.string().max(1000).optional().default(''),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
})

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
      return NextResponse.json({ success: true, request: null }, { status: 201 })
    }

    const validated = requestSchema.safeParse(body)
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

    // If an experience_id was supplied, it must resolve to a real, published
    // experience — never trust a client-supplied id blindly into a FK.
    let experienceId: string | null = null
    if (validated.data.experience_id) {
      const { data: exp } = await supabase
        .from('experiences')
        .select('id, status')
        .eq('id', validated.data.experience_id)
        .maybeSingle()
      if (!exp || exp.status !== 'published') {
        return NextResponse.json({ error: 'Experience not found' }, { status: 404 })
      }
      experienceId = exp.id
    }

    const customer = await findOrCreateCustomerByPhone({
      phone: validated.data.phone,
      name: validated.data.full_name,
      email: validated.data.email || null,
    })

    const { data, error } = await supabase
      .from('experience_bookings')
      .insert({
        experience_id: experienceId,
        customer_id: customer.id,
        full_name: validated.data.full_name,
        phone: validated.data.phone,
        email: validated.data.email || '',
        spots_requested: validated.data.spots_requested,
        notes: validated.data.notes,
        is_custom_request: !experienceId,
        preferred_date: validated.data.preferred_date || null,
        interests: validated.data.interests,
        duration_preference: validated.data.duration_preference,
        source: 'website',
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('experience_bookings insert error:', error)
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
    }

    await recordCustomerActivity(customer.id)

    return NextResponse.json({ success: true, request: data }, { status: 201 })
  } catch (err) {
    console.error('Experience request API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
