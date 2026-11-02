'use client'

import { useTranslations } from 'next-intl'
import { formatAmount, localizeDigits } from '@/lib/format'
import { paymentRows, type QuoteView } from '@/lib/trip-builder/view'
import { quoteReconciles } from '@/lib/trip-builder/quote-state'
import { cn } from '@/lib/utils'

/**
 * Literal-key switches, not `t(dynamicVariable)` — see the note in
 * `JourneySection.tsx`. `errorKey` is a runtime value (`quoteErrorKey()`),
 * so every branch here is spelled out as its own `t('literal')` call.
 */
function useQuoteErrorText(errorKey: string): string {
  const t = useTranslations('builder')
  switch (errorKey) {
    case 'quoteRateLimited': return t('quoteRateLimited')
    case 'quoteScheduleError': return t('quoteScheduleError')
    case 'quoteRoomsManual': return t('quoteRoomsManual')
    case 'quoteRoomTypeUnavailable': return t('quoteRoomTypeUnavailable')
    case 'quoteRoomsCapacity': return t('quoteRoomsCapacity')
    case 'quoteRoomsTooMany': return t('quoteRoomsTooMany')
    default: return t('quoteError')
  }
}

/**
 * Section 8 — Price & payment. Renders exactly what the server returned from
 * `POST /api/trip-requests/quote`: it never computes a total or a payment
 * kind itself. Shared verbatim between the desktop sticky panel and the
 * mobile bottom sheet.
 */
export function PriceSummary({
  quote,
  refreshing,
  errorKey,
  missing = [],
  locale,
  className,
}: {
  /** Only ever a quote priced for the selections on screen (see useQuote). */
  quote: QuoteView | null
  refreshing: boolean
  errorKey: string
  /** quoteReadiness().missing — what still blocks a price. */
  missing?: readonly string[]
  locale: 'ar' | 'en'
  className?: string
}) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  // A total whose lines don't add up is never shown — that is a pricing
  // defect to report, not a number to charge.
  const shown = quote && quoteReconciles(quote) ? quote : null
  const rows = paymentRows(shown)
  const quoteErrorText = useQuoteErrorText(quote && !shown ? 'quoteError' : errorKey)
  const manual = errorKey === 'quoteRoomsManual'
  const idle = !shown && !manual && !refreshing && !errorKey

  return (
    <section aria-live="polite" aria-atomic="false" className={cn('space-y-4', className)}>
      {idle && <p className="text-sm text-ink-subtle">{missing.length && !missing.includes('dates') ? t('quotePaused') : t('addDates')}</p>}
      {refreshing && <p role="status" className="text-sm font-medium text-sea-900">{t('recalculating')}</p>}

      {shown && (
        <>
          <div className="space-y-2.5">
            {shown.lines.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block text-sea-900">{localizeDigits(locale === 'ar' ? line.label_ar : line.label_en, locale)}</span>
                  {(line.detail_ar || line.detail_en) && (
                    <span className="block text-xs text-ink-subtle">{localizeDigits((locale === 'ar' ? line.detail_ar : line.detail_en) ?? '', locale)}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-sea-900">{formatAmount(line.amount, locale)} {common('egp')}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t border-sand-300 pt-3.5">
            <span className="font-display text-base font-bold text-sea-900">{t('total')}</span>
            <span className="font-display text-2xl font-bold tabular-nums text-sea-900">{formatAmount(shown.total, locale)} {common('egp')}</span>
          </div>

          <div className="space-y-1.5 rounded-xl bg-sand-100 p-3.5 text-sm">
            <p className="font-semibold text-sea-900">{t('nowNothing')}</p>
            {rows.map((row) => (
              <p key={row.key} className="text-ink-muted">
                {row.key === 'after_confirmation'
                  ? t('afterConfirmation', { amount: formatAmount(row.amount, locale) })
                  : t('onArrival', { amount: formatAmount(row.amount, locale) })}
              </p>
            ))}
          </div>

        </>
      )}

      {errorKey && manual && (
        <p role="status" className="rounded-xl bg-sand-100 p-3.5 text-sm font-medium text-sea-900">
          {quoteErrorText}
        </p>
      )}
      {((errorKey && !manual) || (quote && !shown)) && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {quoteErrorText}
        </p>
      )}
    </section>
  )
}
