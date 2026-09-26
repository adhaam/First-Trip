import { useTranslations } from 'next-intl'
import type { PaymentDescriptor } from '@/lib/editions'

/** Renders the exact ICU payment templates from editions.json — nothing is assembled as a raw string here. */
export function EditionPayment({ payment }: { payment: PaymentDescriptor | null }) {
  const t = useTranslations('editions')
  if (!payment) return null

  return (
    <div className="space-y-1 text-sm leading-relaxed text-ink-muted">
      {payment.kind === 'PAY_IN_FULL' && <p>{t('payment.payInFull')}</p>}
      {payment.kind === 'PERCENT_DEPOSIT' && payment.depositPercent !== null && (
        <p>{t('payment.percentDeposit', { value: payment.depositPercent })}</p>
      )}
      {payment.kind === 'FIXED_DEPOSIT' && payment.depositAmountEgp !== null && (
        <p>{t('payment.fixedDeposit', { amount: payment.depositAmountEgp })}</p>
      )}
      {payment.balanceDueDaysBeforeStart !== null && (
        <p>{t('payment.balanceDue', { days: payment.balanceDueDaysBeforeStart })}</p>
      )}
    </div>
  )
}
