import { NextRequest, NextResponse } from 'next/server'
import { createTripRequest } from '@/lib/trip-requests/service'
import { verifyTurnstile } from '@/lib/turnstile'

// ─── M2 Trip Builder submission ────────────────────────────────────────────
//
// POST /api/trip-requests creates a structured trip_requests row (migration
// 032). No public UI reads or lists these — the builder posts once, on
// submit, with contact details. Protections mirror /api/bookings exactly:
// a per-IP rate limit, a `website` honeypot field, and optional Turnstile
// verification (env-gated, same as public-booking.ts / bookings/route.ts).
//
// ─────────────────────────────────────────────────────────────────────────

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

  if (entry.count >= RATE_LIMIT) {
    return false
  }

  entry.count += 1
  return true
}

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

    if (body && typeof body === 'object' && 'website' in body && (body as { website?: unknown }).website) {
      // Honeypot tripped — pretend success, do nothing.
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const turnstileToken =
      body && typeof body === 'object' && typeof (body as { turnstile_token?: unknown }).turnstile_token === 'string'
        ? (body as { turnstile_token: string }).turnstile_token
        : null

    if (process.env.TURNSTILE_SECRET_KEY && !(await verifyTurnstile(turnstileToken))) {
      return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
    }

    const result = await createTripRequest(body)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, code: result.code, ...(result.details ? { details: result.details } : {}) },
        { status: result.status },
      )
    }

    return NextResponse.json(
      {
        success: true,
        id: result.id,
        reference: result.reference,
        quoted_total: result.quoted_total,
        payment_plan: result.payment_plan,
      },
      { status: 201 },
    )
  } catch (err) {
    console.error('Trip request API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
