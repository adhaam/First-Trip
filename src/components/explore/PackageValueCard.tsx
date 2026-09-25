import { PaymentTerms } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import type { PaymentKind, PaymentPolicy } from '@/lib/payment-rules'
import type { TripPackage } from '@/lib/types'

/**
 * The package detail sidebar's pricing block — "booked separately" struck
 * through against the package price, with savings only shown when `totals`
 * (computed server-side in `computePackageTotals`) actually has a positive
 * one. Never computes anything itself.
 */
export function PackageValueCard({
  totals,
  kind,
  policies,
  locale,
  labels,
}: {
  totals: NonNullable<TripPackage['totals']>
  kind: PaymentKind
  policies: PaymentPolicy[]
  locale: string
  labels: {
    packageValue: string
    bookedSeparately: string
    packagePrice: string
    youSave: string
    /** "per person" / "للفرد" — every total here sums per-person trip prices, never a household rate. */
    perPerson: string
    egp: string
  }
}) {
  const unit = <span className="ms-1 text-xs font-normal text-ink-muted">{labels.egp} · {labels.perPerson}</span>

  return (
    <div className="rounded-2xl border border-sand-300 bg-card p-5">
      <h2 className="font-display text-xl font-bold text-sea-900">{labels.packageValue}</h2>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-ink-muted">{labels.bookedSeparately}</dt>
          <dd className="tabular-nums line-through">
            {formatAmount(totals.publicTotal, locale)}
            {unit}
          </dd>
        </div>
        <div className="flex justify-between gap-4 font-bold text-sea-900">
          <dt>{labels.packagePrice}</dt>
          <dd className="tabular-nums">
            {formatAmount(totals.packageTotal, locale)}
            {unit}
          </dd>
        </div>
        {totals.savings > 0 && (
          <div className="flex justify-between gap-4 rounded-lg bg-sun-50 p-2 font-bold text-sun-700">
            <dt>{labels.youSave}</dt>
            <dd className="tabular-nums">
              {formatAmount(totals.savings, locale)}
              {unit}
            </dd>
          </div>
        )}
      </dl>
      <div className="mt-5 border-t border-sand-300 pt-4">
        <PaymentTerms kind={kind} policies={policies} />
      </div>
    </div>
  )
}
