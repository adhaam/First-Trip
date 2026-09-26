import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyTurnstile } from '@/lib/turnstile'
import { editionRequestSchema } from '@/lib/editions'
import { getPublicEditionForRequest } from '@/lib/editions-data'

// Simple in-memory per-IP rate limit, consistent with /api/newsletter,
// /api/experience-requests and /api/partner-inquiries.
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

    // Honeypot: a bot that fills the hidden `website` field gets a fake success.
    if (body && typeof body === 'object' && 'website' in body && body.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const validated = editionRequestSchema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      const humanVerified = await verifyTurnstile(validated.data.turnstile_token ?? null)
      if (!humanVerified) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }
    }

    // Server-side truth: the Edition must exist and still be publicly
    // visible right now — a stale/expired/hidden slug on the client cannot
    // write a request row at all.
    const edition = await getPublicEditionForRequest(validated.data.edition_id)
    if (!edition) {
      return NextResponse.json({ error: 'This Edition is not available' }, { status: 404 })
    }

    const supabase = getSupabaseAdmin()
    const { email, message, requested_start_date, travelers, turnstile_token: _turnstile, ...rest } = validated.data
    void _turnstile
    const { error } = await supabase
      .from('edition_requests')
      .insert({
        ...rest,
        edition_id: edition.id,
        edition_slug: edition.slug,
        // Frozen at submission time — never re-derived from a later edit
        // to the Edition's title.
        edition_title_snapshot: rest.locale === 'ar' ? edition.title_ar : edition.title_en,
        email: email || null,
        message: message || null,
        requested_start_date: requested_start_date || null,
        travelers: travelers ?? null,
        source: 'edition',
        status: 'new',
      })

    if (error) {
      console.error('edition_requests insert error:', error)
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 })
    }

    // Never "booked" — this only records a request; a curator confirms
    // availability and the next step separately (see editions.json
    // requestForm.successTitle, the exact copy shown to the visitor).
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Edition requests API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
