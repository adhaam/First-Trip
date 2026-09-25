'use client'

import { useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Compass } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { EmptyState, ResultCount } from '@/components/EmptyState'
import { TripCategoryNav } from '@/components/explore/TripCategoryNav'
import { TripCategoryRail } from '@/components/explore/TripCategoryRail'
import { TripGrid } from '@/components/explore/TripGrid'
import { deriveTripCategoryChips } from '@/lib/trip-categories'
import { tripsForCategory } from '@/lib/explore'
import { formatCount } from '@/lib/format'
import type { SinaiTrip } from '@/lib/types'

/**
 * The exploration experience behind `/sinai-trips`: category chips drive a
 * `?category=` URL param (deep-linkable, no full reload) that either shows
 * every category as its own featured-trip-plus-rail section, or — once one
 * category is chosen — a focused grid of just that category's trips.
 */
export function SinaiTripsClient({
  trips,
  initialCategory = 'all',
}: {
  trips: SinaiTrip[]
  initialCategory?: string
}) {
  const t = useTranslations('explore')
  const locale = useLocale()
  const router = useRouter()

  const categories = useMemo(() => deriveTripCategoryChips(trips), [trips])
  const filtered = useMemo(() => tripsForCategory(trips, initialCategory), [trips, initialCategory])

  const selectCategory = (categoryId: string) => {
    const href = categoryId === 'all' ? '/sinai-trips' : `/sinai-trips?category=${encodeURIComponent(categoryId)}`
    router.replace(href, { scroll: false })
  }

  if (!trips.length) {
    return <EmptyState variant="curating" icon={<Compass />} title={t('noTrips')} hint={t('noTripsHint')} />
  }

  return (
    <div>
      <TripCategoryNav categories={categories} selected={initialCategory} onSelect={selectCategory} />

      <ResultCount
        count={filtered.length}
        label={t('results', { count: filtered.length, n: formatCount(filtered.length, locale) })}
        className="my-5"
      />

      {!filtered.length ? (
        <EmptyState title={t('noResults')} onClear={() => selectCategory('all')} />
      ) : initialCategory === 'all' ? (
        <div className="space-y-12">
          {categories.map((category) => {
            const entries = tripsForCategory(trips, category.id)
            return entries.length ? <TripCategoryRail key={category.id} category={category} trips={entries} /> : null
          })}
        </div>
      ) : (
        <TripGrid trips={filtered} />
      )}
    </div>
  )
}
