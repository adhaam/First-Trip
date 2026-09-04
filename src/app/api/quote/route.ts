import { NextRequest, NextResponse } from 'next/server'
import { computeQuote, quoteSchema } from '@/lib/quote-service'

// ─── calculate_package_quote ──────────────────────────────────────────────────
//
// Narrow public quote endpoint. Returns a fully-computed price breakdown
// WITHOUT creating a booking or touching any mutable state.
//
// Designed for:
//   - Ask WEEMAP AI chat (n8n will wire this in a later pass)
//   - Any other server-to-server price query
//
// The pricing itself lives in lib/quote-service.ts, shared with the admin
// preview endpoint and the manual-booking creation route so a quote, the
// number the dashboard shows an employee, and the amount actually stored on
// a booking can never disagree.
//
// Security contract (same as /api/bookings):
//   - Server fetches all prices from DB — client prices are IGNORED
//   - upgrade_id is validated against the accommodation's upgrade list
//   - Fake client supplements have zero effect
//   - Internal pricing config (DB rows) is never returned
//
// This route responds with the quote's legacy body only — the normalised
// line breakdown and the persistable snapshot stay server-side.
//
// ─────────────────────────────────────────────────────────────────────────────

// Simple in-memory per-IP rate limit, consistent with /api/bookings and
// /api/trip-bookings. Quote calc is low-risk (no DB write, no PII) so the
// limit is generous — this exists to keep casual scrapers/bots from hammering
// the endpoint, not to restrict legitimate price-checking.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
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

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0] ||
    req.headers.get('x-real-ip') ||
    'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const validated = quoteSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: validated.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const result = await computeQuote(validated.data)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.response)
  } catch (err) {
    console.error('Quote API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
