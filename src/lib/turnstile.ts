// Cloudflare Turnstile server-side verification — fully optional, env-gated.
//
// If TURNSTILE_SECRET_KEY is not set, verification is skipped entirely and
// this always returns true. This is deliberate: we never want to hard-fail
// legitimate users because CAPTCHA infrastructure isn't configured for this
// deployment. Only when the secret IS configured do missing/invalid tokens
// get rejected.

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export async function verifyTurnstile(token: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true // not configured — skip silently, never blocks real users

  if (!token) return false

  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    })
    if (!res.ok) return false
    const data = (await res.json()) as { success?: boolean }
    return data.success === true
  } catch (err) {
    console.error('Turnstile verification error:', err)
    // Fail open on network/infra errors so a Cloudflare outage never blocks
    // real bookings — the honeypot + rate limiter still provide a baseline.
    return true
  }
}
