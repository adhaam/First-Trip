// ─── Signature Experience pricing + partner-privacy helpers ───
// Pure functions only (no Supabase import) so they're testable without a
// live DB — see experience-pricing.test.ts.
//
// Signature Experience pricing is INDEPENDENT and Admin-managed. It is never
// derived from Trip Package rules (SUM(package_price)) — linking a Sinai
// Trip or a partner to an experience is purely informational/credit and
// must never influence discountedPrice() below.

export interface ExperiencePriceInput {
  price: number
  discount_value?: number | null
  discount_type?: 'amount' | 'percentage' | null
}

/** The one place a Signature Experience's customer-facing price is computed. */
export function discountedExperiencePrice(exp: ExperiencePriceInput): number {
  if (!exp.discount_value) return exp.price
  if (exp.discount_type === 'percentage') {
    return Math.max(0, exp.price * (1 - exp.discount_value / 100))
  }
  return Math.max(0, exp.price - exp.discount_value)
}

/** A published experience needs a real, positive price — independent of any linked Trip Package or trip. */
export function validateExperiencePublishable(price: number | null | undefined): string | null {
  if (!price || price <= 0) {
    return 'A published Signature Experience needs a price greater than 0.'
  }
  return null
}

export interface PartnerRow {
  id: string
  name: string
  public_description_ar: string
  public_description_en: string
  public_credit_enabled: boolean
  // Any private field below must never appear in the return type of toPublicPartners.
  contact_name?: string
  contact_phone?: string
  contact_email?: string
  internal_notes?: string
}

export interface PublicPartner {
  id: string
  name: string
  public_description_ar: string
  public_description_en: string
}

/**
 * The ONLY function allowed to turn a partner row into something a public
 * page/API may return. Filters out any partner with public_credit_enabled
 * false, and the return type structurally excludes every private field
 * (contact_name/phone/email, internal_notes) even if present on the input.
 */
export function toPublicPartners(rows: PartnerRow[]): PublicPartner[] {
  return rows
    .filter((p) => p.public_credit_enabled)
    .map((p) => ({
      id: p.id,
      name: p.name,
      public_description_ar: p.public_description_ar,
      public_description_en: p.public_description_en,
    }))
}
