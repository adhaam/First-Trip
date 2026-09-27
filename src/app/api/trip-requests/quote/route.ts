import { NextRequest, NextResponse } from 'next/server'
import { tripRequestQuoteSchema } from '@/lib/trip-requests/schema'
import { priceTripRequest } from '@/lib/trip-requests/service'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 120
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

/** A non-persistent, server-authoritative trip price preview. */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
    if (!rateLimit(ip)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    const body = await req.json().catch(() => null)
    if (body && typeof body === 'object' && 'website' in body && (body as { website?: unknown }).website) {
      return NextResponse.json({ error: 'Invalid request', code: 'HONEYPOT' }, { status: 400 })
    }
    const parsed = tripRequestQuoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid trip request.', code: 'VALIDATION_ERROR', details: parsed.error.flatten() }, { status: 400 })
    }
    const result = await priceTripRequest(parsed.data)
    if (!result.ok) return NextResponse.json({ error: result.error, code: result.code }, { status: result.status })
    return NextResponse.json({
      currency: 'EGP',
      dates: {
        arrival_date: result.dates.arrivalDate,
        departure_date: result.dates.departureDate,
        nights: result.dates.nights,
        duration_days: result.dates.durationDays,
      },
      total: result.quote.total,
      lines: result.quote.lines.map(({ key, label_ar, label_en, detail_ar, detail_en, amount }) => ({
        key, label_ar, label_en, ...(detail_ar ? { detail_ar } : {}), ...(detail_en ? { detail_en } : {}), amount,
      })),
      payment: result.paymentPlan,
    })
  } catch (error) {
    console.error('Trip request quote API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
