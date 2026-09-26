// ─── WEEMAP Editions — pure domain logic ───
// No React, no Supabase import — see src/lib/editions-data.ts for fetches
// and src/lib/editions.test.ts for coverage. Follows the same "pure
// functions only" convention as src/lib/experience-pricing.ts and
// src/lib/pricing.ts: everything here is testable without a live DB.

import { z } from 'zod'

export const EDITION_CATEGORIES = ['LEARN', 'RETREAT', 'ADVENTURE', 'MUSIC_EVENT', 'SPECIAL'] as const
export type EditionCategory = (typeof EDITION_CATEGORIES)[number]

export const EDITION_STATUSES = [
  'COMING_SOON', 'OPEN', 'GUARANTEED', 'FEW_SPOTS', 'SOLD_OUT', 'WAITLIST', 'COMPLETED', 'HIDDEN',
] as const
export type EditionStatus = (typeof EDITION_STATUSES)[number]

/** Statuses that may ever appear on a public page. HIDDEN never does. */
export const PUBLIC_STATUSES = EDITION_STATUSES.filter((s) => s !== 'HIDDEN') as readonly EditionStatus[]

/** Statuses where a visitor can actually move toward booking. */
export const BOOKABLE_STATUSES = ['OPEN', 'GUARANTEED', 'FEW_SPOTS'] as const

export const EDITION_REQUEST_INTENTS = ['JOIN', 'ASK', 'NOTIFY'] as const
export type EditionRequestIntent = (typeof EDITION_REQUEST_INTENTS)[number]

export const EDITION_PAYMENT_MODES = ['PAY_IN_FULL', 'PERCENT_DEPOSIT', 'FIXED_DEPOSIT'] as const
export type EditionPaymentMode = (typeof EDITION_PAYMENT_MODES)[number]

export interface EditionProgramItem {
  label_en: string
  label_ar: string
  title_en: string
  title_ar: string
  description_en: string
  description_ar: string
}

export interface EditionCopyItem {
  en: string
  ar: string
}

/**
 * The public shape of an Edition — exactly the columns
 * src/lib/editions-data.ts is allowed to select for a public page. No
 * internal worksheet/partner-link field belongs on this type; see
 * InternalEdition below for the admin-only superset.
 */
export interface PublicEdition {
  id: string
  slug: string
  title_en: string
  title_ar: string
  short_description_en: string
  short_description_ar: string
  full_description_en: string
  full_description_ar: string
  category: EditionCategory
  status: EditionStatus
  featured: boolean
  published: boolean
  sort_order: number
  hero_image_url: string | null
  start_date: string | null
  end_date: string | null
  location_en: string | null
  location_ar: string | null
  price_per_person_egp: number | null
  payment_mode: EditionPaymentMode | null
  deposit_value: number | null
  balance_due_days_before_start: number | null
  max_group_size: number | null
  level_en: string | null
  level_ar: string | null
  who_for_en: string | null
  who_for_ar: string | null
  stay_en: string | null
  stay_ar: string | null
  good_to_know_en: string | null
  good_to_know_ar: string | null
  includes: EditionCopyItem[]
  excludes: EditionCopyItem[]
  program: EditionProgramItem[]
  partner_name: string | null
  partner_logo_url: string | null
  partner_role_en: string | null
  partner_role_ar: string | null
  partner_url: string | null
}

/** Admin-only superset — internal worksheet + partner link, never sent to a public page. */
export interface InternalEdition extends PublicEdition {
  partner_id: string | null
  min_group_size: number | null
  cost_variable_per_guest_egp: number | null
  cost_fixed_egp: number | null
  contingency_pct: number | null
  created_at: string
  updated_at: string
}

/** Never publicly visible: unpublished, or explicitly HIDDEN. */
export function isPubliclyVisible(edition: Pick<PublicEdition, 'published' | 'status'>): boolean {
  return edition.published && edition.status !== 'HIDDEN'
}

/**
 * Which request intent the CTA should submit for a given status.
 * COMPLETED has no CTA at all (returns null) — an Edition that already
 * happened cannot be joined, asked about, or waitlisted for.
 */
export function ctaIntentFor(status: EditionStatus): EditionRequestIntent | null {
  switch (status) {
    case 'COMING_SOON':
      return 'NOTIFY'
    case 'OPEN':
    case 'GUARANTEED':
    case 'FEW_SPOTS':
      return 'JOIN'
    case 'WAITLIST':
    case 'SOLD_OUT':
      return 'ASK'
    case 'COMPLETED':
    case 'HIDDEN':
      return null
  }
}

type Locale = 'en' | 'ar'

/** Picks the localized value of a bilingual `<field>_en`/`<field>_ar` pair, e.g. pick(edition, 'title', locale). */
export function pick<T extends Record<string, unknown>, K extends string>(
  record: T,
  field: K,
  locale: Locale,
): T[`${K}_${Locale}`] {
  return record[`${field}_${locale}` as keyof T] as T[`${K}_${Locale}`]
}

export function localizedCopy(item: EditionCopyItem, locale: Locale): string {
  return locale === 'ar' ? item.ar : item.en
}

/** program.json ordered by array index (its stored order is authoritative — no separate sort_order column). */
export function sortedProgram(edition: Pick<PublicEdition, 'program'>): EditionProgramItem[] {
  return [...(edition.program || [])]
}

export interface PaymentDescriptor {
  // Structured pieces so the UI applies the exact ICU templates from
  // editions.json — never assembled as a string here.
  kind: EditionPaymentMode
  depositPercent: number | null
  depositAmountEgp: number | null
  balanceDueDaysBeforeStart: number | null
}

/**
 * Builds a structured payment descriptor, or null when the config is
 * missing/invalid — the UI renders nothing in that case (never guesses).
 * COMING_SOON Editions have no commercial fields set, so this is always
 * null for them by construction, not by a status check here.
 */
type PaymentScheduleInput = Pick<
  PublicEdition,
  'payment_mode' | 'deposit_value' | 'balance_due_days_before_start' | 'price_per_person_egp'
>

export function paymentSchedule(edition: PaymentScheduleInput): PaymentDescriptor | null {
  const { payment_mode, deposit_value, balance_due_days_before_start, price_per_person_egp } = edition
  if (!payment_mode) return null
  if (price_per_person_egp === null || price_per_person_egp === undefined || price_per_person_egp < 0) return null

  if (payment_mode === 'PAY_IN_FULL') {
    return { kind: 'PAY_IN_FULL', depositPercent: null, depositAmountEgp: null, balanceDueDaysBeforeStart: null }
  }

  if (payment_mode === 'PERCENT_DEPOSIT') {
    if (deposit_value === null || deposit_value === undefined || deposit_value <= 0 || deposit_value > 100) return null
    return {
      kind: 'PERCENT_DEPOSIT',
      depositPercent: deposit_value,
      depositAmountEgp: null,
      balanceDueDaysBeforeStart: balance_due_days_before_start ?? null,
    }
  }

  if (payment_mode === 'FIXED_DEPOSIT') {
    if (deposit_value === null || deposit_value === undefined || deposit_value <= 0) return null
    return {
      kind: 'FIXED_DEPOSIT',
      depositPercent: null,
      depositAmountEgp: deposit_value,
      balanceDueDaysBeforeStart: balance_due_days_before_start ?? null,
    }
  }

  return null
}

export interface EditionWorksheet {
  /** Total variable + fixed cost, evaluated at the internal min_group_size (worst-case per-guest cost). */
  costAtMin: number
  /** Revenue at min_group_size minus costAtMin, before contingency. */
  contributionAtMin: number
  /** contributionAtMin as a percentage of revenue at min_group_size. */
  marginPct: number
}

/**
 * Decision-support only — never mutates price_per_person_egp or any other
 * commercial field. Returns null when there isn't enough internal data
 * (min_group_size, price, or either cost input missing) to compute anything
 * meaningful, rather than showing a misleading zero.
 */
export function worksheet(
  edition: Pick<
    InternalEdition,
    'min_group_size' | 'price_per_person_egp' | 'cost_variable_per_guest_egp' | 'cost_fixed_egp' | 'contingency_pct'
  >,
): EditionWorksheet | null {
  const { min_group_size, price_per_person_egp, cost_variable_per_guest_egp, cost_fixed_egp, contingency_pct } = edition
  if (!min_group_size || min_group_size <= 0) return null
  if (price_per_person_egp === null || price_per_person_egp === undefined) return null
  if (cost_variable_per_guest_egp === null || cost_variable_per_guest_egp === undefined) return null
  if (cost_fixed_egp === null || cost_fixed_egp === undefined) return null

  const contingencyMultiplier = 1 + (contingency_pct ?? 0) / 100
  const variableTotal = cost_variable_per_guest_egp * min_group_size
  const costAtMin = (variableTotal + cost_fixed_egp) * contingencyMultiplier
  const revenueAtMin = price_per_person_egp * min_group_size
  const contributionAtMin = revenueAtMin - costAtMin
  const marginPct = revenueAtMin > 0 ? (contributionAtMin / revenueAtMin) * 100 : 0

  return { costAtMin, contributionAtMin, marginPct }
}

// ─── zod schemas ───

const localeSchema = z.enum(['en', 'ar'])

const copyItemSchema = z.object({ en: z.string().min(1), ar: z.string().min(1) })

const programItemSchema = z.object({
  label_en: z.string(),
  label_ar: z.string(),
  title_en: z.string().min(1),
  title_ar: z.string().min(1),
  description_en: z.string(),
  description_ar: z.string(),
})

/**
 * Base object schema (no cross-field refinement) — exported separately so
 * the admin PATCH route can call `.partial()` on it (Zod doesn't allow
 * `.partial()` on the refined `editionAdminSchema` below, since a
 * ZodEffects wrapper has no object shape to make partial).
 */
export const editionAdminObjectSchema = z.object({
  slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/, 'slug must be lowercase, digits and hyphens only'),
  title_en: z.string().min(1).max(200),
  title_ar: z.string().min(1).max(200),
  short_description_en: z.string().max(500).default(''),
  short_description_ar: z.string().max(500).default(''),
  full_description_en: z.string().max(5000).default(''),
  full_description_ar: z.string().max(5000).default(''),
  category: z.enum(EDITION_CATEGORIES),
  status: z.enum(EDITION_STATUSES).default('COMING_SOON'),
  featured: z.boolean().default(false),
  published: z.boolean().default(false),
  sort_order: z.number().int().default(0),
  hero_image_url: z.string().url().nullable().optional(),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  location_en: z.string().max(200).nullable().optional(),
  location_ar: z.string().max(200).nullable().optional(),
  price_per_person_egp: z.number().min(0).nullable().optional(),
  payment_mode: z.enum(EDITION_PAYMENT_MODES).nullable().optional(),
  deposit_value: z.number().min(0).nullable().optional(),
  balance_due_days_before_start: z.number().int().min(0).nullable().optional(),
  min_group_size: z.number().int().min(1).nullable().optional(),
  max_group_size: z.number().int().min(1).nullable().optional(),
  level_en: z.string().max(200).nullable().optional(),
  level_ar: z.string().max(200).nullable().optional(),
  who_for_en: z.string().max(500).nullable().optional(),
  who_for_ar: z.string().max(500).nullable().optional(),
  stay_en: z.string().max(500).nullable().optional(),
  stay_ar: z.string().max(500).nullable().optional(),
  good_to_know_en: z.string().max(2000).nullable().optional(),
  good_to_know_ar: z.string().max(2000).nullable().optional(),
  includes: z.array(copyItemSchema).default([]),
  excludes: z.array(copyItemSchema).default([]),
  program: z.array(programItemSchema).default([]),
  partner_id: z.string().uuid().nullable().optional(),
  partner_name: z.string().max(200).nullable().optional(),
  partner_logo_url: z.string().url().nullable().optional(),
  partner_role_en: z.string().max(200).nullable().optional(),
  partner_role_ar: z.string().max(200).nullable().optional(),
  partner_url: z.string().url().nullable().optional(),
  cost_variable_per_guest_egp: z.number().min(0).nullable().optional(),
  cost_fixed_egp: z.number().min(0).nullable().optional(),
  contingency_pct: z.number().min(0).max(100).nullable().optional(),
})

const refineDateOrder = (v: { start_date?: string | null; end_date?: string | null }) =>
  !v.start_date || !v.end_date || v.end_date >= v.start_date

/** Admin create payload — everything optional except the identity fields required to create a row. */
export const editionAdminSchema = editionAdminObjectSchema.refine(
  refineDateOrder,
  { message: 'end_date must be on or after start_date', path: ['end_date'] },
)

/** Admin update payload — every field optional (PATCH), same date-order rule when both dates are present. */
export const editionAdminUpdateSchema = editionAdminObjectSchema.partial().refine(
  refineDateOrder,
  { message: 'end_date must be on or after start_date', path: ['end_date'] },
)

export type EditionAdminInput = z.infer<typeof editionAdminSchema>

// Public request payload — POST /api/edition-requests. edition_id is
// required; partner-related fields never appear here.
export const editionRequestSchema = z.object({
  edition_id: z.string().uuid(),
  intent: z.enum(EDITION_REQUEST_INTENTS),
  requested_start_date: z.string().date().nullable().optional(),
  customer_name: z.string().min(2).max(100),
  phone: z.string().min(6).max(20),
  email: z.string().email().nullable().optional().or(z.literal('')),
  travelers: z.number().int().min(1).max(50).nullable().optional(),
  message: z.string().max(1000).nullable().optional(),
  locale: localeSchema,
  turnstile_token: z.string().optional(),
})

export type EditionRequestInput = z.infer<typeof editionRequestSchema>
