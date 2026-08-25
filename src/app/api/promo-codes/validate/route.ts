import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validatePromoCodeForSections } from '@/lib/promo-codes'
import { applyDiscount } from '@/lib/pricing'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20
const RATE_WINDOW = 10 * 60 * 1000

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

const SECTION = z.enum(['rent', 'merch', 'sinai_trips'])

const schema = z.object({
  code: z.string().min(1).max(40),
  // A single section, or an array when the cart spans more than one
  // (e.g. a rental + a merch item) — the code must cover all of them.
  section: SECTION.optional(),
  sections: z.array(SECTION).min(1).optional(),
  // Optional: lets the client preview the discounted amount immediately.
  // The server recomputes this again at order/booking creation — this
  // value is a preview only, never trusted for the actual charge.
  amount: z.number().min(0).optional(),
}).refine((v) => v.section || v.sections, { message: 'section or sections is required' })

/**
 * Public, read-only preview endpoint — tells the checkout UI whether a
 * code is valid and what it would save, without applying anything. The
 * actual discount is always re-resolved server-side when the order or
 * booking is created.
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const validated = schema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ valid: false, error: 'Invalid request' }, { status: 400 })
  }

  const sections = validated.data.sections || [validated.data.section!]
  const result = await validatePromoCodeForSections(validated.data.code, sections)
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason })
  }

  const preview = validated.data.amount != null
    ? applyDiscount(validated.data.amount, result.promo.discount_value, result.promo.discount_type)
    : null

  return NextResponse.json({
    valid: true,
    label: result.promo.label,
    discount_type: result.promo.discount_type,
    discount_value: result.promo.discount_value,
    preview,
  })
}
