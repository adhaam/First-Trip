import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatAmount,
  formatCount,
  formatDate,
  formatDateShort,
  formatNumber,
  formatReference,
  resolveLocale,
} from './format'

// ─── locale resolution ──────────────────────────────────────────────────────

test('resolveLocale narrows to the two locales the app ships', () => {
  assert.equal(resolveLocale('en'), 'en')
  assert.equal(resolveLocale('ar'), 'ar')
  // Anything unexpected falls back to the default locale rather than throwing.
  assert.equal(resolveLocale('fr'), 'ar')
  assert.equal(resolveLocale(undefined), 'ar')
  assert.equal(resolveLocale(null), 'ar')
  assert.equal(resolveLocale(''), 'ar')
})

// ─── the bug this module exists to prevent ──────────────────────────────────

test('the same amount renders identically for a given locale, every time', () => {
  // The regression: 22 call sites used a bare toLocaleString(), so a trip card
  // and that trip's detail page could disagree within one page view.
  const price = 3500
  const arRenders = [formatAmount(price, 'ar'), formatAmount(price, 'ar'), formatAmount(price, 'ar')]
  assert.equal(new Set(arRenders).size, 1)
  const enRenders = [formatAmount(price, 'en'), formatAmount(price, 'en')]
  assert.equal(new Set(enRenders).size, 1)
})

test('Arabic and English use different numeral systems, deterministically', () => {
  const ar = formatAmount(3500, 'ar')
  const en = formatAmount(3500, 'en')
  assert.equal(en, '3,500')
  assert.notEqual(ar, en)
  // Arabic-Indic digits, matching the convention lib/pricing.ts already used.
  assert.match(ar, /[٠-٩]/)
  assert.doesNotMatch(ar, /[0-9]/)
})

test('formatting never depends on the ambient runtime locale', () => {
  // No call signature allows omitting the locale, so there is no path by which
  // the server and the browser can disagree.
  assert.equal(formatAmount(1234, 'en'), '1,234')
  assert.equal(formatNumber(1234, 'en'), '1,234')
  assert.equal(formatCount(1234, 'en'), '1,234')
})

test('formatEGP output is unchanged for every locale the app actually ships', async () => {
  // pricing.ts's formatEGP now delegates here. This pins the equivalence so a
  // future change to the formatter cannot silently alter a rendered price.
  const { formatEGP } = await import('./pricing')
  const previousImplementation = (value: number, locale: string) =>
    Math.round(value).toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')

  const amounts = [0, 1, 7, 99, 100, 999, 1000, 1234.4, 1234.5, 1234.6, 45000, 999999, 1234567.89, -50]
  for (const amount of amounts) {
    for (const locale of ['ar', 'en']) {
      assert.equal(
        formatEGP(amount, locale),
        previousImplementation(amount, locale),
        `formatEGP(${amount}, '${locale}') changed`,
      )
    }
  }
})

test('an unrecognised locale falls back to the app default, not to English', () => {
  // routing.defaultLocale is 'ar'. next-intl only ever hands us 'ar' or 'en',
  // so this path is unreachable in the app — it is pinned so the fallback is a
  // decision rather than an accident.
  assert.equal(formatAmount(1000, 'fr'), formatAmount(1000, 'ar'))
  assert.equal(formatAmount(1000, ''), formatAmount(1000, 'ar'))
})

// ─── amounts ────────────────────────────────────────────────────────────────

test('formatAmount rounds to whole pounds, preserving the previous behaviour', () => {
  assert.equal(formatAmount(1234.4, 'en'), '1,234')
  assert.equal(formatAmount(1234.5, 'en'), '1,235')
  assert.equal(formatAmount(1234.6, 'en'), '1,235')
})

test('formatAmount accepts the string amounts Supabase returns for numerics', () => {
  assert.equal(formatAmount('4500', 'en'), '4,500')
  assert.equal(formatAmount('4500.75', 'en'), '4,501')
})

test('a customer never sees NaN', () => {
  assert.equal(formatAmount(undefined, 'en'), '0')
  assert.equal(formatAmount(null, 'en'), '0')
  assert.equal(formatAmount('not a number', 'en'), '0')
  assert.equal(formatAmount(Number.POSITIVE_INFINITY, 'en'), '0')
  assert.equal(formatCount(Number.NaN, 'en'), '0')
})

test('formatCount truncates rather than rounding — 1.9 guests is 1 guest', () => {
  assert.equal(formatCount(1.9, 'en'), '1')
  assert.equal(formatCount(3, 'en'), '3')
})

test('formatNumber passes Intl options through', () => {
  assert.equal(formatNumber(0.5, 'en', { style: 'percent' }), '50%')
  assert.equal(formatNumber(1234.567, 'en', { maximumFractionDigits: 2 }), '1,234.57')
})

// ─── dates ──────────────────────────────────────────────────────────────────

test('a bare calendar date is not shifted across a timezone boundary', () => {
  // 'YYYY-MM-DD' parsed as UTC midnight renders as the previous day anywhere
  // west of Greenwich. It must be read as a local calendar date.
  assert.match(formatDate('2026-03-14', 'en'), /^14 March 2026$/)
})

test('dates use the established per-locale convention', () => {
  assert.equal(formatDate('2026-03-14', 'en'), '14 March 2026')
  const ar = formatDate('2026-03-14', 'ar')
  assert.match(ar, /[٠-٩]/)
  assert.notEqual(ar, formatDate('2026-03-14', 'en'))
})

test('formatDateShort is the dense variant of the same date', () => {
  assert.equal(formatDateShort('2026-03-14', 'en'), '14 Mar 2026')
})

test('an unusable date renders as nothing, never "Invalid Date"', () => {
  assert.equal(formatDate(undefined, 'en'), '')
  assert.equal(formatDate(null, 'en'), '')
  assert.equal(formatDate('', 'en'), '')
  assert.equal(formatDate('definitely-not-a-date', 'en'), '')
})

test('formatDate accepts a Date and a full ISO timestamp', () => {
  assert.equal(formatDate(new Date('2026-03-14T10:00:00Z'), 'en'), '14 March 2026')
  assert.equal(formatDate('2026-03-14T10:00:00Z', 'en'), '14 March 2026')
})

// ─── machine values ─────────────────────────────────────────────────────────

test('references are never localised — they must stay byte-stable', () => {
  // An order number rendered with Arabic-Indic digits cannot be typed back into
  // a support form or matched against the database.
  assert.equal(formatReference('WM-2026-000123'), 'WM-2026-000123')
  assert.equal(formatReference(1234567), '1234567')
  assert.equal(formatReference(null), '')
  assert.equal(formatReference(undefined), '')
})
