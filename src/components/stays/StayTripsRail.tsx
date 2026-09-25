'use client'

import { useTranslations } from 'next-intl'
import { Rail } from '@/components/brand/Rail'
import { TripCard } from '@/components/cards/TripCard'
import type { SinaiTrip } from '@/lib/types'

const RAIL_LIMIT = 8

/**
 * "Popular trips from Dahab" — the top Sinai trips by admin sort_order,
 * reusing the same TripCard (and its effectiveTripPrice pricing) every other
 * trip rail on the site uses, so nothing about a trip's price or discount is
 * recomputed here. Honestly labelled: these are WEEMAP's featured trips, not
 * a personalised "guests also booked" — there is no such data.
 */
export function StayTripsRail({ trips }: { trips: SinaiTrip[] }) {
  const t = useTranslations('stays')

  if (trips.length === 0) return null

  return (
    <Rail label={t('detail.tripsHint')}>
      {trips.slice(0, RAIL_LIMIT).map((trip) => (
        <div key={trip.id} className="rail-snap-item w-[82vw] shrink-0 sm:w-80">
          <TripCard trip={trip} />
        </div>
      ))}
    </Rail>
  )
}
