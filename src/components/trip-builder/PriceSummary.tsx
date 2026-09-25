'use client'

import { useTranslations } from 'next-intl'
import { PaymentTerms } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import type { PaymentKind } from '@/lib/payment-rules'
import { paymentRows, type QuoteView } from '@/lib/trip-builder/view'
import { cn } from '@/lib/utils'

/**
 * Literal-key switches, not `t(dynamicVariable)` — see the note in
 * `JourneySection.tsx`. `part.kind` and `errorKey` are both runtime values
 * (the server's response / `quoteErrorKey()`), so every branch here is
 * spelled out as its own `t('literal')` call.
 */
function usePaymentKindLabel(kind: PaymentKind): string {
  const t = useTranslations('builder')
  switch (kind) {
    case 'stay': return t('paymentKindStay')
    case 'stay_package': return t('paymentKindStayPackage')
    case 'transfer': return t('paymentKindTransfer')
    case 'experience_package': return t('paymentKindExperiencePackage')
    case 'trip':
    case 'signature':
    case 'commerce':
    case 'rental':
    default: return t('paymentKindTrip')
  }
}

function useQuoteErrorText(errorKey: string): string {
  const t = useTranslations('builder')
  switch (errorKey) {
    case 'quoteRateLimited': return t('quoteRateLimited')
    case 'quoteScheduleError': return t('quoteScheduleError')
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
  policies,
  locale,
  className,
}: {
  quote: QuoteView | null
  refreshing: boolean
  errorKey: string
  policies: import('@/lib/payment-rules').PaymentPolicy[]
  locale: 'ar' | 'en'
  className?: string
}) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const rows = paymentRows(quote)
  const quoteErrorText = useQuoteErrorText(errorKey)

  return (
    <section aria-live="polite" aria-atomic="false" className={cn('space-y-4', className)}>
      {!quote && <p className="text-sm text-ink-subtle">{t('addDates')}</p>}

      {quote && (
        <>
          <div className="space-y-2.5">
            {quote.lines.map((line) => (
              <div key={line.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="block text-sea-900">{locale === 'ar' ? line.label_ar : line.label_en}</span>
                  {(line.detail_ar || line.detail_en) && (
                    <span className="block text-xs text-ink-subtle">{locale === 'ar' ? line.detail_ar : line.detail_en}</span>
                  )}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-sea-900">{formatAmount(line.amount, locale)} {common('egp')}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between border-t border-sand-300 pt-3.5">
            <span className="font-display text-base font-bold text-sea-900">{t('total')}</span>
            <span className="font-display text-2xl font-bold tabular-nums text-sea-900">{formatAmount(quote.total, locale)} {common('egp')}</span>
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

          {quote.payment.parts.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-subtle">{t('paymentBreakdown')}</p>
              <div className="space-y-2.5">
                {quote.payment.parts.map((part, index) => (
                  <PaymentPartRow key={`${part.kind}-${index}`} kind={part.kind} policies={policies} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {refreshing && <p className="text-xs text-ink-subtle">{t('updating')}</p>}
      {errorKey && (
        <p role="alert" className="text-sm font-medium text-red-700">
          {quoteErrorText}
        </p>
      )}
    </section>
  )
}

function PaymentPartRow({ kind, policies }: { kind: PaymentKind; policies: import('@/lib/payment-rules').PaymentPolicy[] }) {
  const label = usePaymentKindLabel(kind)
  return (
    <div className="text-xs">
      <p className="font-semibold text-sea-900">{label}</p>
      <PaymentTerms kind={kind} policies={policies} compact />
    </div>
  )
}
