import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAdminSessionToken, ADMIN_COOKIE, SESSION_MS } from '@/lib/admin-session'
import { getSupabaseAdmin } from '@/lib/supabase'
import { dummyStaffHash, verifyStaffPassword } from '@/lib/staff-password'
import { isStaffRole } from '@/lib/staff-policy'

// Simple in-memory rate limit — mirrors the pattern already used in /api/bookings
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 10
const WINDOW_MS = 15 * 60 * 1000

function rateLimited(key: string): boolean {
  const now = Date.now()
  const entry = attempts.get(key)
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= MAX_ATTEMPTS) return true
  entry.count += 1
  return false
}

const loginSchema = z.object({
  email: z.string().trim().max(200).optional(),
  password: z.string().min(1).max(200),
})

function sameSecret(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function sessionResponse(token: string, body: Record<string, unknown>) {
  const res = NextResponse.json({ success: true, ...body })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_MS / 1000),
  })
  return res
}

const invalid = () => NextResponse.json({ error: 'Invalid email or password', code: 'invalid_credentials' }, { status: 401 })

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts, try again later' }, { status: 429 })
  }
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error('ADMIN_SESSION_SECRET env var is not set — admin login is disabled')
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalid()
  const { password } = parsed.data
  const email = parsed.data.email?.toLowerCase() ?? ''
  const supabase = getSupabaseAdmin()

  if (email) {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, role, is_active, password_hash, session_version')
      .eq('email', email)
      .maybeSingle()
    if (error && !isMissingTable(error)) {
      console.error('staff login lookup failed:', error)
      return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
    }
    const ok = await verifyStaffPassword(password, data?.password_hash ?? await dummyStaffHash())
    if (!data || !ok || !data.is_active || !isStaffRole(data.role)) return invalid()

    await supabase.from('staff_users').update({ last_login_at: new Date().toISOString() }).eq('id', data.id)
    const token = await createAdminSessionToken({ sid: data.id, ver: data.session_version, role: data.role })
    if (!token) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
    return sessionResponse(token, { legacy: false })
  }

  // Legacy shared password: only to bootstrap the first owner account.
  const adminPassword = process.env.ADMIN_PASSWORD
  const { count, error } = await supabase
    .from('staff_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'owner')
    .eq('is_active', true)
  if (error && !isMissingTable(error)) {
    console.error('staff owner lookup failed:', error)
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
  }
  if (!error && (count ?? 0) > 0) {
    return NextResponse.json({ error: 'Sign in with your email and password', code: 'email_required' }, { status: 401 })
  }
  if (!adminPassword || !sameSecret(password, adminPassword)) return invalid()

  const token = await createAdminSessionToken({ sid: 'legacy', ver: 0, role: 'owner' })
  if (!token) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  return sessionResponse(token, { legacy: true })
}
