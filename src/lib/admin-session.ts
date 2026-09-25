// ─── Operations Center session tokens ───
// Web Crypto only (crypto.subtle / btoa) so this runs in the proxy (edge) and
// in Node route handlers alike. It proves a cookie was issued by this server
// and has not expired — nothing more. Whether the person still has access is
// decided per request by requireAdmin() in src/lib/admin-auth.ts, which checks
// the staff row and its session_version (migration 035).

import { isStaffRole, type StaffRole } from './staff-policy'

export const ADMIN_COOKIE = 'admin_session'
export const SESSION_MS = 12 * 60 * 60 * 1000 // 12 hours

/** `sid` is a staff_users id, or 'legacy' for the pre-M3 shared password. */
export type AdminSessionClaims = {
  sid: string
  ver: number
  role: StaffRole
  exp: number
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToString(value: string): string | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(payload))))
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

export async function createAdminSessionToken(
  claims: Omit<AdminSessionClaims, 'exp'>,
  now = Date.now(),
): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return null
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify({ ...claims, exp: now + SESSION_MS })))
  return `${payload}.${await sign(payload, secret)}`
}

/** Signature + expiry + shape only. Pre-M3 tokens (a bare timestamp) are rejected. */
export async function verifyAdminSessionToken(
  token: string | undefined | null,
  now = Date.now(),
): Promise<AdminSessionClaims | null> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || !token) return null
  const [payload, sig, extra] = token.split('.')
  if (!payload || !sig || extra !== undefined) return null
  if (!timingSafeEqual(sig, await sign(payload, secret))) return null

  const json = base64UrlToString(payload)
  if (!json) return null
  let claims: unknown
  try {
    claims = JSON.parse(json)
  } catch {
    return null
  }
  if (!claims || typeof claims !== 'object') return null
  const { sid, ver, role, exp } = claims as Record<string, unknown>
  if (typeof sid !== 'string' || !sid || typeof ver !== 'number' || !Number.isInteger(ver)) return null
  if (!isStaffRole(role) || typeof exp !== 'number' || now > exp) return null
  return { sid, ver, role, exp }
}
