// ─── Admin session helpers ───
// Uses Web Crypto only (crypto.subtle / btoa) so this works in both the
// Edge middleware runtime and normal Node API routes without polyfills.
//
// Model: a single shared admin password (process.env.ADMIN_PASSWORD).
// On success we issue a signed, expiring cookie (HMAC-SHA256 with
// process.env.ADMIN_SESSION_SECRET) instead of a real user session table.
// This is intentionally simple — it closes the "no auth at all" hole
// without requiring a full Supabase Auth user setup. If/when there's a
// need for multiple admin accounts with different permissions, replace
// this with real Supabase Auth.

export const ADMIN_COOKIE = 'admin_session'
const SESSION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function bufToBase64Url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const base64 = btoa(binary)
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  return bufToBase64Url(sig)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return result === 0
}

export async function createAdminSessionToken(): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret) return null
  const exp = Date.now() + SESSION_MS
  const payload = String(exp)
  const sig = await sign(payload, secret)
  return `${payload}.${sig}`
}

export async function verifyAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || !token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  if (!Number.isFinite(Number(payload)) || Date.now() > Number(payload)) return false
  const expectedSig = await sign(payload, secret)
  return timingSafeEqual(sig, expectedSig)
}

// Convenience for API route handlers (Node runtime): checks the cookie on a
// standard Request/NextRequest-like object.
export async function requireAdmin(req: { cookies: { get(name: string): { value: string } | undefined } }): Promise<boolean> {
  const token = req.cookies.get(ADMIN_COOKIE)?.value
  return verifyAdminSessionToken(token)
}
