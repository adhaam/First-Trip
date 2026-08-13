import { NextRequest, NextResponse } from 'next/server'
import { createAdminSessionToken, ADMIN_COOKIE } from '@/lib/admin-auth'

// Simple in-memory rate limit — mirrors the pattern already used in /api/bookings
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function rateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_ATTEMPTS) return true
  entry.count += 1
  return false
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }

  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) {
    console.error('ADMIN_PASSWORD env var is not set — admin login is disabled')
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  }

  const body = await req.json().catch(() => null)
  const password = typeof body?.password === 'string' ? body.password : ''

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
  }

  const token = await createAdminSessionToken()
  if (!token) {
    console.error('ADMIN_SESSION_SECRET env var is not set — admin login is disabled')
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  }

  const res = NextResponse.json({ success: true })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return res
}
