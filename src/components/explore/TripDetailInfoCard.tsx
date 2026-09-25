import { Clock } from 'lucide-react'
import { PaymentTerms } from '@/components/brand'
import { PickupNote } from '@/components/explore/PickupNote'
import type { PaymentPolicy } from '@/lib/payment-rules'

/** The trip detail sidebar's facts card: duration (or the honest "date arranged with you"), the pickup truth line, and payment terms. */
export function TripDetailInfoCard({
  duration,
  dateConfirmedLabel,
  durationLabel,
  pickupLabel,
  policies,
}: {
  duration: string
  dateConfirmedLabel: string
  durationLabel: string
  pickupLabel: string
  policies: PaymentPolicy[]
}) {
  return (
    <div className="rounded-2xl border border-sand-300 bg-sand-100 p-5">
      <dl className="space-y-4 text-sm">
        <div className="flex gap-2">
          <Clock className="h-4 w-4 shrink-0 text-sun-700" aria-hidden />
          <div>
            <dt className="text-ink-muted">{durationLabel}</dt>
            <dd className="font-semibold text-sea-900">{duration || dateConfirmedLabel}</dd>
          </div>
        </div>
        <PickupNote label={pickupLabel} />
      </dl>
      <div className="mt-5 border-t border-sand-300 pt-4">
        <PaymentTerms kind="trip" policies={policies} />
      </div>
    </div>
  )
}
