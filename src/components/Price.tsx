'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatAmount } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The single place money is rendered to a customer.
 *
 * It owns four things that were previously decided ad-hoc at ~22 call sites:
 *
 *   1. Numerals. Always locale-explicit (see lib/format.ts) so Arabic and
 *      English never disagree and server/client never diverge.
 *   2. The currency word, from `common.egp`, kept in its own element at its own
 *      size so the amount stays the thing you read first.
 *   3. The unit. A price with no unit is the most common cause of hesitation on
 *      a request form — "3,500" means nothing until you know it is per person
 *      or per room per night.
 *   4. The zero case. Cards used to render a literal "0 EGP" whenever a rate
 *      was not configured. That reads as free. It now renders the
 *      price-on-request line instead, which is also the honest state for a
 *      request → availability-confirmation business.
 *
 * It does NOT calculate, round business values, apply discounts, or convert
 * currency. It receives a number that pricing logic already produced.
 *
 * `originalAmount` is the one discount-adjacent affordance, and it stays
 * consistent with that rule: the caller passes BOTH the pre-discount and the
 * final number (from effectiveTripPrice in lib/pricing.ts) and this component
 * only decides how to draw the pair. It never derives one from the other.
 */

type PriceSize = 'sm' | 'md' | 'lg' | 'xl'

const AMOUNT_SIZE: Record<PriceSize, string> = {
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-3xl',
}

const CURRENCY_SIZE: Record<PriceSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
  xl: 'text-base',
}

export function Price({
  amount,
  /** Optional label above the amount, e.g. "From" / "يبدأ من". */
  label,
  /** Optional unit below the amount, e.g. "per night · per room". */
  unit,
  size = 'md',
  tone = 'ink',
  className,
  /** Render the unavailable state instead of an amount (e.g. quote-on-request). */
  unavailable = false,
  /**
   * The pre-discount price, shown struck through beside the amount. Ignored
   * unless it is genuinely higher than `amount`, so a caller can pass it
   * unconditionally without having to branch on "is there a discount".
   */
  originalAmount,
}: {
  amount: number | string | null | undefined
  label?: string
  unit?: string
  size?: PriceSize
  tone?: 'ink' | 'light'
  className?: string
  unavailable?: boolean
  originalAmount?: number | string | null
}) {
  const locale = useLocale()
  const common = useTranslations('common')
  const n = Number(amount)
  const hasPrice = !unavailable && Number.isFinite(n) && n > 0
  const original = Number(originalAmount)
  const showOriginal = hasPrice && Number.isFinite(original) && original > n

  const labelTone = tone === 'light' ? 'text-white/75' : 'text-ink-subtle'
  const amountTone = tone === 'light' ? 'text-white' : 'text-ink'
  const currencyTone = tone === 'light' ? 'text-white/80' : 'text-ink-muted'

  if (!hasPrice) {
    return (
      <div className={className}>
        <div className={cn('font-display font-bold leading-tight', AMOUNT_SIZE[size], amountTone)}>
          {common('priceOnRequest')}
        </div>
        {unit && <div className={cn('mt-0.5 text-xs', labelTone)}>{unit}</div>}
      </div>
    )
  }

  return (
    <div className={className}>
      {label && (
        <div className={cn('text-[0.7rem] uppercase tracking-wider', labelTone)}>{label}</div>
      )}
      <div className={cn('font-display font-bold leading-tight', AMOUNT_SIZE[size], amountTone)}>
        {showOriginal && (
          <span className={cn('me-1.5 font-normal tabular-nums line-through', CURRENCY_SIZE[size], labelTone)}>
            {formatAmount(original, locale)}
          </span>
        )}
        {/* tabular-nums keeps columns of prices aligned in carts and summaries */}
        <span className="tabular-nums">{formatAmount(n, locale)}</span>{' '}
        <span className={cn('font-semibold', CURRENCY_SIZE[size], currencyTone)}>
          {common('egp')}
        </span>
      </div>
      {unit && <div className={cn('mt-0.5 text-xs', labelTone)}>{unit}</div>}
    </div>
  )
}

/**
 * Inline variant for running text and summary rows, where the price sits inside
 * a sentence or a flex row rather than in its own stacked block.
 */
export function PriceInline({
  amount,
  className,
  tone = 'ink',
}: {
  amount: number | string | null | undefined
  className?: string
  tone?: 'ink' | 'light'
}) {
  const locale = useLocale()
  const common = useTranslations('common')
  const n = Number(amount)

  if (!Number.isFinite(n) || n <= 0) {
    return <span className={className}>{common('priceOnRequest')}</span>
  }

  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="tabular-nums">{formatAmount(n, locale)}</span>{' '}
      <span className={cn('font-semibold', tone === 'light' ? 'text-white/80' : 'text-ink-muted')}>
        {common('egp')}
      </span>
    </span>
  )
}
