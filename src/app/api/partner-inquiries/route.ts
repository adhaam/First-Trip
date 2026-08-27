import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSupabaseAdmin } from '@/lib/supabase'
import { verifyTurnstile } from '@/lib/turnstile'

const requestSchema = z.object({
  name: z.string().min(2).max(100),
  business_name: z.string().max(150).optional().or(z.literal('')),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional().or(z.literal('')),
  partnership_type: z.string().max(60).optional().or(z.literal('')),
  message: z.string().min(10).max(1000),
  website: z.string().max(200).optional(),
  turnstile_token: z.string().optional(),
})

// Simple in-memory per-IP rate limit, consistent with /api/newsletter and
// /api/experience-requests.
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

    if (body && typeof body === 'object' && 'website' in body && body.website) {
      return NextResponse.json({ success: true, inquiry: null }, { status: 201 })
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
    const { data, error } = await supabase
      .from('partner_inquiries')
      .insert({
        name: validated.data.name,
        business_name: validated.data.business_name || null,
        phone: validated.data.phone,
        email: validated.data.email || null,
        partnership_type: validated.data.partnership_type || null,
        message: validated.data.message,
        status: 'new',
      })
      .select()
      .single()

    if (error) {
      console.error('partner_inquiries insert error:', error)
      return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
    }

    return NextResponse.json({ success: true, inquiry: data }, { status: 201 })
  } catch (err) {
    console.error('Partner inquiries API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
