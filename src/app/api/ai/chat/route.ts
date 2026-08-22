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

const SYSTEM_PROMPT = `You are WEEMAP, the AI assistant for WEEMAP SINAI — a travel booking platform for trips to Dahab, Sinai, Egypt.

You help users with:
- Dahab accommodation packages (4-night Thu→Mon or 5-night Sun→Fri with transfers included)
- Sinai day trips and excursions (snorkeling, diving, desert safaris, Saint Catherine, etc.)
- Transfer booking (shared bus or private Hiace from any Egyptian governorate)
- General travel info about Dahab and South Sinai

Key facts:
- Packages include transfer + accommodation + included day trips
- Prices are quoted in Egyptian Pounds (EGP)
- Bookings are confirmed before any payment is taken
- Contact via WhatsApp for final confirmation

Be friendly, concise, and helpful. Answer in the same language the user writes in (Arabic or English). Keep responses under 300 words. If you don't know a specific price, say the user can use the booking form for an exact quote.`

async function callOllama(
  message: string,
  ollamaUrl: string,
  model: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        stream: false,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) {
      console.error('Ollama error:', res.status, await res.text().catch(() => ''))
      return null
    }
    const data = await res.json().catch(() => null)
    const text = data?.message?.content || data?.response || null
    return typeof text === 'string' ? text : null
  } catch (err) {
    console.error('Ollama call failed:', err instanceof Error ? err.message : 'UnknownError')
    return null
  }
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

    // ── Path 1: Ollama (direct) ──────────────────────────────────────────────
    const ollamaUrl = process.env.WEEMAP_OLLAMA_URL?.trim()
    const ollamaModel = process.env.WEEMAP_OLLAMA_MODEL?.trim() || 'qwen2.5'
    if (ollamaUrl) {
      const reply = await callOllama(parsed.data.message, ollamaUrl, ollamaModel)
      if (!reply) {
        return NextResponse.json({ error: { code: 'AI_UNAVAILABLE' } }, { status: 503 })
      }
      return NextResponse.json({
        message: reply.slice(0, 4000),
        sessionId: parsed.data.sessionId,
        actions: [],
      })
    }

    // ── Path 2: n8n webhook (legacy) ─────────────────────────────────────────
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
