'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { TripCard } from '@/components/cards/TripCard'
import { TripPackageRail } from '@/components/TripPackageRail'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SinaiTrip, TripPackage } from '@/lib/types'

type ContentFilter = 'all' | 'trips' | 'packages'

// Individual trips stay the main content — this many render before the
// premium Trip Packages rail is inserted, with the rest continuing after.
const TRIPS_BEFORE_RAIL = 6

export function SinaiTripsClient({
  trips,
  packages = [],
}: {
  trips: SinaiTrip[]
  packages?: TripPackage[]
}) {
  const t = useTranslations('sinai')
  const states = useTranslations('states')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<string>('all')
  const [contentFilter, setContentFilter] = useState<ContentFilter>('all')

  const categories = [
    { id: 'all', label_ar: 'كل الرحلات', label_en: 'All Trips' },
    ...Array.from(new Set(trips.map((tr) => (ar ? tr.category_ar : tr.category_en))))
      .filter(Boolean)
      .map((c) => ({ id: c, label_ar: c, label_en: c })),
  ]

  const filtered =
    filter === 'all' ? trips : trips.filter((trip) => (ar ? trip.category_ar : trip.category_en) === filter)

  if (trips.length === 0 && packages.length === 0) {
    return (
      <div className="container-main py-16 text-center text-sea-900/40">
        {states('noTrips')}
      </div>
    )
  }

  const showTrips = contentFilter !== 'packages'
  const showPackages = contentFilter !== 'trips' && packages.length > 0
  const firstBatch = showTrips ? filtered.slice(0, TRIPS_BEFORE_RAIL) : []
  const restBatch = showTrips ? filtered.slice(TRIPS_BEFORE_RAIL) : []

  return (
    <>
      {packages.length > 0 && (
        <div className="no-scrollbar mb-4 flex items-center gap-2 overflow-x-auto pb-2">
          {([
            ['all', ar ? 'الكل' : 'All'],
            ['trips', ar ? 'الرحلات' : 'Trips'],
            ['packages', ar ? 'الباكدجات' : 'Packages'],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setContentFilter(id)}
              aria-pressed={contentFilter === id}
              className={cn(
                'min-h-9 shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors',
                contentFilter === id
                  ? 'bg-sea-900 text-white'
                  : 'border border-sand-300 bg-white text-sea-900/60 hover:text-sea-900',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showTrips && (
        <div className="no-scrollbar mb-8 flex items-center gap-2 overflow-x-auto pb-2">
          <Filter className="h-4 w-4 shrink-0 text-sea-900/35" />
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilter(cat.id)}
              aria-pressed={filter === cat.id}
              className={cn(
                'min-h-11 shrink-0 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                filter === cat.id
                  ? 'bg-sun-500 text-white'
                  : 'border border-sand-300 bg-white text-sea-900/60 hover:text-sea-900',
              )}
            >
              {cat.id === 'all' ? (ar ? cat.label_ar : cat.label_en) : cat.id}
            </button>
          ))}
        </div>
      )}

      {showTrips && filtered.length === 0 && !showPackages && (
        <div className="py-16 text-center text-sea-900/40">
          {states('noTripMatches')}
        </div>
      )}

      {showTrips && firstBatch.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {firstBatch.map((trip, i) => (
            <Reveal key={trip.id} delay={(i % 9) * 60} className={cn('h-full', i === 0 && 'sm:col-span-2 lg:col-span-2')}>
              <TripCard trip={trip} includesLabel={t('includes')} featured={i === 0} />
            </Reveal>
          ))}
        </div>
      )}

      {showPackages && contentFilter === 'all' && <TripPackageRail packages={packages} />}

      {showPackages && contentFilter === 'packages' && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, i) => (
            <Reveal key={pkg.id} delay={(i % 9) * 60} className="h-full">
              <TripPackageCard pkg={pkg} />
            </Reveal>
          ))}
        </div>
      )}

      {showTrips && restBatch.length > 0 && (
        <div className={cn('grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3', showPackages && contentFilter === 'all' && 'mt-5')}>
          {restBatch.map((trip, i) => (
            <Reveal key={trip.id} delay={(i % 9) * 60}>
              <TripCard trip={trip} includesLabel={t('includes')} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}
