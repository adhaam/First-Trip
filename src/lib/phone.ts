/**
 * Pure phone-normalization logic — deliberately has NO 'server-only' or
 * Supabase import so it can be unit tested directly (see phone.test.ts) and
 * reused from anywhere (client-side preview formatting, server resolution).
 *
 * Mirrors the Postgres function `normalize_phone_eg` (see
 * supabase/migrations/013_unified_commerce_foundation.sql) — keep both in
 * sync if the normalization rules ever change.
 */

/**
 * Best-effort E.164-style phone normalization.
 *
 * Confidently resolves Egyptian mobile variants:
 *   01012345678, +201012345678, 00201012345678 -> +201012345678
 *
 * For anything else that isn't confidently an Egyptian mobile number, we
 * never reorder or guess-strip digits — we only strip an obvious "00"
 * international prefix and prepend "+". Numbers too short/long to be
 * plausible return null (not stored as normalized_phone).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/[^0-9]/g, '')
  if (!digits) return null

  if (digits.startsWith('00')) {
    digits = digits.slice(2)
  }

  // Egyptian mobile with country code: 20 1[0-9] XXXXXXXX (12 digits)
  if (digits.startsWith('20') && digits.length === 12 && digits[2] === '1') {
    return `+${digits}`
  }

  // Local Egyptian mobile: 01[0-9]XXXXXXXX (11 digits, leading 0)
  if (digits.startsWith('0') && digits.length === 11 && digits[1] === '1') {
    return `+20${digits.slice(1)}`
  }

  // Egyptian mobile missing both leading 0 and country code (10 digits)
  if (digits.length === 10 && digits[0] === '1') {
    return `+20${digits}`
  }

  // Plausible international number — trust as-is, just add "+"
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`
  }

  return null
}
