import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  aiChatRequestSchema,
  isAiFeatureEnabled,
  isValidAiWebhookUrl,
  parseAiUpstreamResponse,
  sameOriginPath,
} from '@/lib/ai-contract'

const bucket = new Map<string, { count: number; resetAt: number }>()
const LIMIT = 20
const WINDOW = 60 * 1000

function allowRequest(key: string) {
  const now = Date.now()
  const current = bucket.get(key)
  if (!current || current.resetAt <= now) {
    bucket.set(key, { count: 1, resetAt: now + WINDOW })
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

  const parsed = aiChatRequestSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_REQUEST' } }, { status: 400 })
  }

  const pageUrl = sameOriginPath(parsed.data.page.url, req.nextUrl.origin)
  if (!pageUrl) {
    return NextResponse.json({ error: { code: 'INVALID_PAGE' } }, { status: 400 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  if (!allowRequest(`${ip}:${parsed.data.sessionId}`)) {
    return NextResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 })
  }

  try {
    const supabase = getSupabaseAdmin()
    const { data: lead, error } = await supabase
      .from('ai_leads')
      .select('id')
      .eq('session_id', parsed.data.sessionId)
      .maybeSingle()

    if (error) {
      console.error('Ask WEEMAP lead lookup failed:', error.code)
      return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
    }
    if (!lead) {
      return NextResponse.json({ error: { code: 'SESSION_NOT_FOUND' } }, { status: 404 })
    }

    const webhookUrl = process.env.WEEMAP_N8N_CHAT_WEBHOOK_URL?.trim() || ''
    const webhookSecret = process.env.WEEMAP_N8N_CHAT_SECRET?.trim() || ''
    if (!webhookUrl || !webhookSecret || !isValidAiWebhookUrl(webhookUrl)) {
      return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
    }

    const upstream = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-weemap-chat-secret': webhookSecret,
      },
      body: JSON.stringify({
        sessionId: parsed.data.sessionId,
        message: parsed.data.message,
        locale: parsed.data.locale,
        page: { ...parsed.data.page, url: pageUrl },
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })

    if (!upstream.ok) {
      console.error('Ask WEEMAP upstream unavailable:', upstream.status)
      return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
    }

    const response = parseAiUpstreamResponse(
      await upstream.json().catch(() => null),
      parsed.data.sessionId,
    )
    if (!response) {
      console.error('Ask WEEMAP upstream returned an invalid contract')
      return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Ask WEEMAP chat API unavailable:', error instanceof Error ? error.name : 'UnknownError')
    return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
  }
}
