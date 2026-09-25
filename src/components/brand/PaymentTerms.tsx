'use client'

import { useLocale, useTranslations } from 'next-intl'
import { formatCount } from '@/lib/format'
import type { PaymentKind, PaymentPolicy } from '@/lib/payment-rules'
import { cn } from '@/lib/utils'

/** Kinds where "confirmation" concretely means room/date availability. */
const AVAILABILITY_KINDS: readonly PaymentKind[] = ['stay', 'stay_package']

/**
 * Pure display of a payment policy — never computes a charge, never picks a
 * default. If `policies` has no active row for `kind`, it says so rather
 * than guessing (see "Server stays authoritative for … payment
 * classification" in docs/m2/BRIEF.md — this component renders what the
 * server decided, nothing more).
 */
export function PaymentTerms({
  kind,
  policies,
  compact = false,
  className,
}: {
  kind: PaymentKind
  policies: PaymentPolicy[]
  compact?: boolean
  className?: string
}) {
  const ui = useTranslations('ui')
  const locale = useLocale()
  const policy = policies.find((candidate) => candidate.booking_kind === kind && candidate.is_active !== false)

  if (!policy) {
    return <p className={cn('text-sm text-ink-subtle', className)}>{ui('paymentUnknown')}</p>
  }

  // Digits follow the site's number policy (Arabic-Indic in Arabic), like prices.
  const upfront = formatCount(policy.upfront_percent, locale)
  const balance = formatCount(100 - policy.upfront_percent, locale)
  const upfrontPhrase = AVAILABILITY_KINDS.includes(kind)
    ? ui('paymentUpfrontAvailability', { percent: upfront })
    : ui('paymentUpfrontConfirmation', { percent: upfront })

  const balancePhrase =
    policy.balance_due === 'on_arrival'
      ? ui('paymentBalanceArrival', { percent: balance })
      : policy.balance_due === 'before_service'
        ? ui('paymentBalanceBeforeService', { percent: balance })
        : null

  return (
    <div className={cn('text-sm', className)}>
      <p className={cn('font-medium', compact ? 'text-ink-muted' : 'text-ink')}>
        {upfrontPhrase}
        {balancePhrase && <> · {balancePhrase}</>}
      </p>
      {!compact && <p className="mt-1 text-xs text-ink-subtle">{ui('paymentNothingOnline')}</p>}
    </div>
  )
}
