'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Chip, Eyebrow, Rail } from '@/components/brand'
import { TripCard } from '@/components/cards/TripCard'
import { formatCount } from '@/lib/format'
import type { TripCategoryChip } from '@/lib/trip-categories'
import type { SinaiTrip } from '@/lib/types'

/**
 * One category's slice of the "all trips" view: an editorial-scale featured
 * trip (the category's top `sort_order` entry — a real, admin-controlled
 * ordering, never a random pick) leading a horizontal rail of the rest. This
 * is the "category-led layout... featured trip per category" the brief asks
 * for, done without inventing any ranking of our own.
 */
export function TripCategoryRail({ category, trips }: { category: TripCategoryChip; trips: SinaiTrip[] }) {
  const t = useTranslations('explore')
  const locale = useLocale()
  const label = locale === 'ar' ? category.name_ar : category.name_en
  const [featured, ...rest] = trips

  if (!featured) return null

  return (
    <section aria-labelledby={`category-${category.id}`} className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id={`category-${category.id}`} className="font-display text-2xl font-bold text-sea-900">
          {label}
        </h2>
        <Chip href={`/sinai-trips?category=${encodeURIComponent(category.slug)}`}>
          {t('results', { count: trips.length, n: formatCount(trips.length, locale) })}
        </Chip>
      </div>

      <Rail label={label}>
        <div className="w-[88%] shrink-0 sm:w-[56%] lg:w-[42%]">
          <Eyebrow className="mb-2">{t('featured', { category: label })}</Eyebrow>
          <TripCard trip={featured} featured includesLabel={t('included')} />
        </div>
        {rest.map((trip) => (
          <div key={trip.id} className="w-[82%] shrink-0 sm:w-[44%] lg:w-[30%]">
            <TripCard trip={trip} />
          </div>
        ))}
      </Rail>
    </section>
  )
}
