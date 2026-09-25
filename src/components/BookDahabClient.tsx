'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BedDouble } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { EmptyState, ResultCount } from '@/components/EmptyState'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { Chip, ChipRail } from '@/components/brand/Chip'
import { FilterSheet } from '@/components/brand/FilterSheet'
import { PriceTag } from '@/components/brand/PriceTag'
import { ButtonLink } from '@/components/ButtonLink'
import { ACCOMMODATION_TAGS, WHATSAPP_NUMBER } from '@/lib/constants'
import {
  accommodationTypeCounts,
  filterAccommodationsByType,
  sortAccommodations,
  startingRoomRate,
  type StayFilterKey,
  type StaySortKey,
} from '@/lib/stays'
import type { Accommodation } from '@/lib/types'

const TYPE_FILTERS: { key: StayFilterKey; labelKey: 'filterAll' | 'filterHotel' | 'filterChalet' | 'filterCamp' }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'hotel', labelKey: 'filterHotel' },
  { key: 'chalet', labelKey: 'filterChalet' },
  { key: 'camp', labelKey: 'filterCamp' },
]

const SORT_OPTIONS: { key: StaySortKey; labelKey: 'sortDefault' | 'sortPriceAsc' | 'sortPriceDesc' }[] = [
  { key: 'default', labelKey: 'sortDefault' },
  { key: 'price-asc', labelKey: 'sortPriceAsc' },
  { key: 'price-desc', labelKey: 'sortPriceDesc' },
]

export function BookDahabClient({
  accommodations,
  whatsapp,
}: {
  accommodations: Accommodation[]
  whatsapp?: string | null
}) {
  const locale = useLocale()
  const t = useTranslations('stays')
  const ar = locale === 'ar'

  const [filterType, setFilterType] = useState<StayFilterKey>('all')
  const [sortBy, setSortBy] = useState<StaySortKey>('default')

  const counts = useMemo(() => accommodationTypeCounts(accommodations), [accommodations])
  const filtered = useMemo(() => filterAccommodationsByType(accommodations, filterType), [accommodations, filterType])
  const sorted = useMemo(() => sortAccommodations(filtered, sortBy), [filtered, sortBy])

  const digits = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const waLink = `https://wa.me/${digits}`

  const [first, ...rest] = sorted

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <ChipRail>
          {TYPE_FILTERS.map((f) => (
            <Chip
              key={f.key}
              selected={filterType === f.key}
              onClick={() => setFilterType(f.key)}
              count={f.key === 'all' ? undefined : counts[f.key]}
              icon={f.key !== 'all' ? <span aria-hidden>{ACCOMMODATION_TAGS[f.key]?.emoji}</span> : undefined}
            >
              {t(`list.${f.labelKey}`)}
            </Chip>
          ))}
        </ChipRail>

        <FilterSheet
          title={t('list.filterSheetTitle')}
          triggerLabel={t('list.sortLabel')}
          activeCount={sortBy !== 'default' ? 1 : 0}
          onReset={sortBy !== 'default' ? () => setSortBy('default') : undefined}
        >
          <div className="flex flex-col gap-2">
            {SORT_OPTIONS.map((s) => (
              <Chip key={s.key} selected={sortBy === s.key} onClick={() => setSortBy(s.key)} className="justify-center">
                {t(`list.${s.labelKey}`)}
              </Chip>
            ))}
          </div>
        </FilterSheet>
      </div>

      <ResultCount count={sorted.length} label={t('list.resultCount', { count: sorted.length })} className="mb-5" />

      {sorted.length === 0 ? (
        <EmptyState
          variant={accommodations.length === 0 ? 'curating' : 'no-results'}
          icon={<BedDouble className="h-8 w-8" />}
          title={accommodations.length === 0 ? t('list.curatingTitle') : t('list.noResultsTitle')}
          hint={accommodations.length === 0 ? t('list.curatingHint') : t('list.noResultsHint')}
          action={
            accommodations.length === 0 ? (
              <ButtonLink href={waLink} target="_blank" rel="noopener" variant="whatsapp" size="lg">
                {t('list.curatingAction')}
              </ButtonLink>
            ) : undefined
          }
          onClear={filterType !== 'all' ? () => setFilterType('all') : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {first && (
            <Reveal className="h-full sm:col-span-2 xl:col-span-2" as="div">
              <EditorialCard
                href={`/book-dahab/${first.id}`}
                image={first.image_url || first.images?.[0] || '/media/heroposter.webp'}
                title={ar ? first.name_ar : first.name_en}
                kicker={ar ? ACCOMMODATION_TAGS[first.type]?.label_ar : ACCOMMODATION_TAGS[first.type]?.label_en}
                meta={<PriceTag amount={startingRoomRate(first)} from unit="night" size="sm" tone="light" />}
                size="lg"
                priority
              />
            </Reveal>
          )}
          {rest.map((acc, i) => (
            <Reveal key={acc.id} delay={(i % 8) * 60} className="h-full">
              <AccommodationCard acc={acc} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}
