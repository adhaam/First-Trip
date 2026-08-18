'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { TripCard } from '@/components/cards/TripCard'
import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SinaiTrip } from '@/lib/types'

export function SinaiTripsClient({
  trips,
}: {
  trips: SinaiTrip[]
}) {
  const t = useTranslations('sinai')
  const states = useTranslations('states')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<string>('all')

  const categories = [
    { id: 'all', label_ar: 'كل الرحلات', label_en: 'All Trips' },
    ...Array.from(new Set(trips.map((tr) => (ar ? tr.category_ar : tr.category_en))))
      .filter(Boolean)
      .map((c) => ({ id: c, label_ar: c, label_en: c })),
  ]

  const filtered =
    filter === 'all' ? trips : trips.filter((trip) => (ar ? trip.category_ar : trip.category_en) === filter)

  if (trips.length === 0) {
    return (
      <div className="container-main py-16 text-center text-sea-900/40">
        {states('noTrips')}
      </div>
    )
  }

  return (
    <>
      {/* Filter bar */}
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

      {filtered.length === 0 ? (
        <div className="py-16 text-center text-sea-900/40">
          {states('noTripMatches')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((trip, i) => (
            <Reveal key={trip.id} delay={(i % 9) * 60} className={cn('h-full', i === 0 && 'sm:col-span-2 lg:col-span-2')}>
              <TripCard trip={trip} includesLabel={t('includes')} featured={i === 0} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}
