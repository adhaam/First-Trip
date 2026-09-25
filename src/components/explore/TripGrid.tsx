'use client'

import { useTranslations } from 'next-intl'
import { TripCard } from '@/components/cards/TripCard'
import type { SinaiTrip } from '@/lib/types'

/** A plain grid of trips — used once a single category is selected, where a rail of one category adds nothing over a grid. */
export function TripGrid({ trips }: { trips: SinaiTrip[] }) {
  const t = useTranslations('explore')

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip, index) => (
        <TripCard
          key={trip.id}
          trip={trip}
          featured={index === 0}
          includesLabel={index === 0 ? t('included') : undefined}
        />
      ))}
    </div>
  )
}
