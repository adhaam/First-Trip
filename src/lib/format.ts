/**
 * Centralised, deterministic, locale-aware formatting for every customer-visible
 * number, price and date.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 * Before this module, 22 call sites rendered money with a bare
 * `value.toLocaleString()` — no locale argument at all. That resolves against
 * the *runtime's* default locale, which means:
 *
 *   1. The same price rendered two different ways in one session. A trip card
 *      showed `3,500` while the trip's own detail page (which did pass 'ar-EG')
 *      showed `٣٬٥٠٠`.
 *   2. Server and browser could disagree whenever the visitor's OS locale was
 *      not the server's — a genuine React hydration mismatch on the single most
 *      scrutinised element on a travel site.
 *
 * Everything here takes an explicit locale. Nothing falls back to the ambient
 * runtime locale, so server and client always produce identical strings.
 *
 * ─── Conventions (preserved, not invented) ──────────────────────────────────
 * These are the conventions the codebase already used at its deliberate call
 * sites; this module makes the stragglers match rather than changing anything:
 *
 *   numbers / money   ar → 'ar-EG'   en → 'en-US'   (matches lib/pricing.ts formatEGP)
 *   dates             ar → 'ar-EG'   en → 'en-GB'   (matches BookingForm + community)
 *
 * ─── What must NEVER pass through here ──────────────────────────────────────
 * Machine values that have to stay byte-stable: booking references, order
 * numbers, IDs, slugs, phone numbers, and anything sent to an API or an
 * analytics vendor. Those stay as plain strings. `formatReference()` is
 * provided so the intent is explicit at the call site.
 *
 * This module formats. It never rounds business values, never converts
 * currency, and never changes a stored amount.
 */

export type AppLocale = 'ar' | 'en'

/** Numeric + currency formatting locale. */
const NUMBER_LOCALE: Record<AppLocale, string> = {
  ar: 'ar-EG',
  en: 'en-US',
}

/** Date formatting locale — `en-GB` gives day-first, which is what the region expects. */
const DATE_LOCALE: Record<AppLocale, string> = {
  ar: 'ar-EG',
  en: 'en-GB',
}

/** Narrows an arbitrary next-intl locale string to the two this app ships. */
export function resolveLocale(locale: string | undefined | null): AppLocale {
  return locale === 'en' ? 'en' : 'ar'
}

/**
 * Format any customer-visible number: prices, totals, counts, quantities.
 * Non-finite input formats as `0` rather than rendering "NaN" to a customer.
 */
export function formatNumber(
  value: number | string | null | undefined,
  locale: string,
  options?: Intl.NumberFormatOptions,
): string {
  const n = Number(value)
  const safe = Number.isFinite(n) ? n : 0
  return new Intl.NumberFormat(NUMBER_LOCALE[resolveLocale(locale)], options).format(safe)
}

/**
 * Money amount, digits only — the currency word is a separate translated string
 * (`common.egp`) so it can sit in its own element and its own type size.
 * Rounds to whole pounds for display, exactly as `formatEGP` in lib/pricing.ts
 * already did. This changes presentation only; the underlying value is untouched.
 */
export function formatAmount(value: number | string | null | undefined, locale: string): string {
  const n = Number(value)
  const safe = Number.isFinite(n) ? Math.round(n) : 0
  return new Intl.NumberFormat(NUMBER_LOCALE[resolveLocale(locale)], {
    maximumFractionDigits: 0,
  }).format(safe)
}

/** Whole-number counts: guests, rooms, nights, quantity, units left. */
export function formatCount(value: number | string | null | undefined, locale: string): string {
  const n = Number(value)
  const safe = Number.isFinite(n) ? Math.trunc(n) : 0
  return new Intl.NumberFormat(NUMBER_LOCALE[resolveLocale(locale)], {
    maximumFractionDigits: 0,
  }).format(safe)
}

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}

/**
 * Format a date for display.
 *
 * Accepts a `YYYY-MM-DD` string (treated as a local calendar date, never shifted
 * by timezone), a full ISO timestamp, or a Date. Invalid input returns an empty
 * string so a broken date renders as nothing rather than "Invalid Date".
 */
export function formatDate(
  value: string | Date | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
): string {
  if (!value) return ''
  const date =
    value instanceof Date
      ? value
      : // A bare calendar date must not be parsed as UTC midnight, or it renders
        // as the previous day for anyone west of Greenwich.
        new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(DATE_LOCALE[resolveLocale(locale)], options).format(date)
}

/** Short numeric date — for dense contexts like list rows and cards. */
export function formatDateShort(value: string | Date | null | undefined, locale: string): string {
  return formatDate(value, locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Identifiers that must stay byte-stable and readable in both directions:
 * booking references, order numbers, phone numbers, IDs.
 *
 * Returns the value untouched. It exists so the call site reads as a deliberate
 * decision not to localise, and so a future refactor cannot "helpfully" pipe an
 * order number through a numeral formatter.
 */
export function formatReference(value: string | number | null | undefined): string {
  return value == null ? '' : String(value)
}
