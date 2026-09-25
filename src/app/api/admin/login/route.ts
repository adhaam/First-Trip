import { NextRequest, NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'
import { createAdminSessionToken, ADMIN_COOKIE, SESSION_MS } from '@/lib/admin-session'
import { getSupabaseAdmin } from '@/lib/supabase'
import { dummyStaffHash, verifyStaffPassword } from '@/lib/staff-password'
import { isStaffRole } from '@/lib/staff-policy'

// Two layers of brute-force protection:
//  1. this in-memory counter — cheap, per server instance;
//  2. staff_login_throttle in the database (migration 041), shared by every
//     instance: 5 failures per account from one address, 20 per account and
//     30 per address within 15 minutes lock that key for 15 minutes. Keys
//     are sha256 hashes, so no email or IP is stored.
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

const sha = (value: string) => createHash('sha256').update(value).digest('hex')

function throttleKeys(email: string, ip: string): { keys: string[]; limits: number[] } {
  const keys = [`ip:${sha(ip)}`]
  const limits = [30]
  if (email) {
    keys.push(`email:${sha(email)}`, `email:${sha(email)}|ip:${sha(ip)}`)
    limits.push(20, 5)
  }
  return { keys, limits }
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

const tooMany = () => NextResponse.json(
  { error: 'Too many attempts, try again later', code: 'rate_limited' },
  { status: 429 },
)

export async function POST(req: NextRequest) {
  // Vercel sets x-real-ip / x-forwarded-for itself; a client cannot choose them.
  const ip = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (rateLimited(ip)) return tooMany()
  if (!process.env.ADMIN_SESSION_SECRET) {
    console.error('ADMIN_SESSION_SECRET env var is not set — admin login is disabled')
    return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  }

  const parsed = loginSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return invalid()
  const { password } = parsed.data
  const email = parsed.data.email?.toLowerCase() ?? ''
  const supabase = getSupabaseAdmin()
  const throttle = throttleKeys(email, ip)

  // Fail closed: if the throttle cannot be read, nobody signs in.
  const { data: lockedUntil, error: throttleError } = await supabase.rpc('weemap_login_throttle_check', {
    p_keys: throttle.keys,
  })
  if (throttleError) {
    console.error('staff login throttle check failed:', throttleError.code, throttleError.message)
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
  }
  if (lockedUntil) return tooMany()

  const recordOutcome = async (success: boolean) => {
    const { error } = await supabase.rpc('weemap_login_throttle_record', {
      p_keys: throttle.keys,
      p_limits: throttle.limits,
      p_success: success,
    })
    if (error) console.error('staff login throttle record failed:', error.code, error.message)
  }

  if (email) {
    const { data, error } = await supabase
      .from('staff_users')
      .select('id, role, is_active, password_hash, session_version')
      .eq('email', email)
      .maybeSingle()
    if (error) {
      console.error('staff login lookup failed:', error.code, error.message)
      return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
    }
    const ok = await verifyStaffPassword(password, data?.password_hash ?? await dummyStaffHash())
    if (!data || !ok || !data.is_active || !isStaffRole(data.role)) {
      await recordOutcome(false)
      return invalid()
    }
    await recordOutcome(true)

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
  // Fail closed: without a readable staff table there is no bootstrap.
  if (error) {
    console.error('staff owner lookup failed:', error.code, error.message)
    return NextResponse.json({ error: 'Sign in failed' }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json({ error: 'Sign in with your email and password', code: 'email_required' }, { status: 401 })
  }
  if (!adminPassword || !sameSecret(password, adminPassword)) {
    await recordOutcome(false)
    return invalid()
  }

  const token = await createAdminSessionToken({ sid: 'legacy', ver: 0, role: 'owner' })
  if (!token) return NextResponse.json({ error: 'Admin login is not configured' }, { status: 500 })
  return sessionResponse(token, { legacy: true })
}
