import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyTurnstile } from '@/lib/turnstile'

const schema = z.object({
  email: z.string().email(),
  locale: z.enum(['ar', 'en']).optional().default('ar'),
  source: z.string().max(60).optional(),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
})

// simple per-IP rate limit to keep casual scrapers away
const bucket = new Map<string, { count: number; resetAt: number }>()
const LIMIT = 5
const WINDOW = 60 * 60 * 1000

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const cur = bucket.get(ip)
  if (!cur || cur.resetAt < now) {
    bucket.set(ip, { count: 1, resetAt: now + WINDOW })
    return true
  }
  if (cur.count >= LIMIT) return false
  cur.count += 1
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

    if (body && typeof body === 'object' && 'website' in body && body.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
    }

    if (process.env.TURNSTILE_SECRET_KEY) {
      const humanVerified = await verifyTurnstile(parsed.data.turnstile_token ?? null)
      if (!humanVerified) {
        return NextResponse.json({ error: 'Verification failed' }, { status: 400 })
      }
    }

    const supabase = getSupabaseAdmin()
    // upsert so re-submitting the same email is idempotent (no error surface)
    const { error } = await supabase
      .from('newsletter_subscribers')
      .upsert(
        {
          email: parsed.data.email.trim().toLowerCase(),
          locale: parsed.data.locale,
          source: parsed.data.source || 'homepage-footer',
          unsubscribed: false,
        },
        { onConflict: 'email' },
      )

    if (error) {
      console.error('Newsletter subscribe error:', error)
      return NextResponse.json({ error: 'Could not subscribe' }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('Newsletter API error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
