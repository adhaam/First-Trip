import 'server-only'
import { getSupabaseAdmin } from '@/lib/supabase'

/** The storefront sections a promo code can be scoped to. */
export type PromoSection = 'rent' | 'merch' | 'sinai_trips'

export interface PromoCode {
  id: string
  code: string
  label: string
  discount_type: 'amount' | 'percentage'
  discount_value: number
  applies_to: PromoSection[]
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  max_uses: number | null
  used_count: number
}

export type PromoValidationResult =
  | { valid: true; promo: PromoCode }
  | { valid: false; reason: 'not_found' | 'inactive' | 'not_started' | 'expired' | 'max_uses_reached' | 'wrong_section' }

async function fetchActivePromoCode(rawCode: string): Promise<PromoCode | null> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return null
  const supabase = getSupabaseAdmin()
  const { data: promo } = await supabase
    .from('promo_codes')
    .select('*')
    .ilike('code', code)
    .maybeSingle()
  return (promo as PromoCode) || null
}

function checkPromoUsable(promo: PromoCode, requiredSections: PromoSection[]): PromoValidationResult {
  if (!promo.is_active) return { valid: false, reason: 'inactive' }

  const now = Date.now()
  if (promo.starts_at && new Date(promo.starts_at).getTime() > now) {
    return { valid: false, reason: 'not_started' }
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() < now) {
    return { valid: false, reason: 'expired' }
  }
  if (promo.max_uses != null && promo.used_count >= promo.max_uses) {
    return { valid: false, reason: 'max_uses_reached' }
  }
  const applies = Array.isArray(promo.applies_to) ? promo.applies_to : []
  if (!requiredSections.every((s) => applies.includes(s))) {
    return { valid: false, reason: 'wrong_section' }
  }
  return { valid: true, promo }
}

/**
 * Look up a promo code and check it's currently redeemable for the given
 * section. This is the single source of truth for whether a code is
 * usable — call it server-side right before applying a discount, never
 * trust a client's claim that a code is valid.
 */
export async function validatePromoCode(
  rawCode: string,
  section: PromoSection,
): Promise<PromoValidationResult> {
  const promo = await fetchActivePromoCode(rawCode)
  if (!promo) return { valid: false, reason: 'not_found' }
  return checkPromoUsable(promo, [section])
}

/**
 * Same as `validatePromoCode`, but for a cart that may span multiple
 * sections at once (e.g. a rental + a merch item) — the code must be
 * valid for every section present, not just one, so a "rent only" code
 * can never silently discount a merch line.
 */
export async function validatePromoCodeForSections(
  rawCode: string,
  sections: PromoSection[],
): Promise<PromoValidationResult> {
  const promo = await fetchActivePromoCode(rawCode)
  if (!promo) return { valid: false, reason: 'not_found' }
  return checkPromoUsable(promo, sections)
}

/** Atomically bumps the usage counter — call once a redemption is confirmed. */
export async function incrementPromoCodeUsage(promoId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.rpc('increment_promo_code_usage', { p_promo_id: promoId })
}
