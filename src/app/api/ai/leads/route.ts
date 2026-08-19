import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { aiLeadSchema, isAiFeatureEnabled, sameOriginPath } from '@/lib/ai-contract'

const bucket = new Map<string, { count: number; resetAt: number }>()
const LIMIT = 8
const WINDOW = 60 * 60 * 1000

function allowRequest(ip: string) {
  const now = Date.now()
  const current = bucket.get(ip)
  if (!current || current.resetAt <= now) {
    bucket.set(ip, { count: 1, resetAt: now + WINDOW })
    return true
  }
  if (current.count >= LIMIT) return false
  current.count += 1
  return true
}

function isSameOriginRequest(req: NextRequest) {
  const origin = req.headers.get('origin')
  return !origin || origin === req.nextUrl.origin
}

export async function POST(req: NextRequest) {
  if (!isAiFeatureEnabled(process.env.NEXT_PUBLIC_WEEMAP_AI_ENABLED)) {
    return NextResponse.json({ error: { code: 'AI_DISABLED' } }, { status: 503 })
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  if (!allowRequest(ip)) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 })
  }

  const parsed = aiLeadSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_LEAD' } }, { status: 400 })
  }

  const initialPageUrl = sameOriginPath(parsed.data.initialPageUrl, req.nextUrl.origin)
  if (!initialPageUrl) {
    return NextResponse.json({ error: { code: 'INVALID_PAGE' } }, { status: 400 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('ai_leads').insert({
      session_id: parsed.data.sessionId,
      name: parsed.data.name,
      whatsapp: parsed.data.whatsapp,
      email: parsed.data.email ? parsed.data.email.toLowerCase() : null,
      locale: parsed.data.locale,
      source: 'website_ai',
      initial_page_url: initialPageUrl,
    })

    // An insert retry for the same anonymous session is successful and must
    // not create or expose a second lead record.
    if (error && error.code !== '23505') {
      console.error('Ask WEEMAP lead insert failed:', error.code)
      return NextResponse.json({ error: { code: 'LEAD_UNAVAILABLE' } }, { status: 503 })
    }

    return NextResponse.json(
      { sessionId: parsed.data.sessionId, status: 'ready' },
      { status: error?.code === '23505' ? 200 : 201 },
    )
  } catch (error) {
    console.error('Ask WEEMAP lead API unavailable:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: { code: 'LEAD_UNAVAILABLE' } }, { status: 503 })
  }
}
