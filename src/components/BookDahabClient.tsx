'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BedDouble, Hotel, Home, Tent, type LucideIcon } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { EmptyState, ResultCount } from '@/components/EmptyState'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { Chip, ChipRail } from '@/components/brand/Chip'
import { FilterSheet } from '@/components/brand/FilterSheet'
import { PriceTag } from '@/components/brand/PriceTag'
import { ButtonLink } from '@/components/ButtonLink'
import { formatCount } from '@/lib/format'
import { ACCOMMODATION_TAGS, WHATSAPP_NUMBER } from '@/lib/constants'
import {
  accommodationTypeCounts,
  filterAccommodationsByType,
  sortAccommodations,
  startingRoomRate,
  type StayFilterKey,
  type StaySortKey,
} from '@/lib/stays'
import type { Accommodation, AccommodationType } from '@/lib/types'
import { cn } from '@/lib/utils'

const TYPE_FILTERS: { key: StayFilterKey; labelKey: 'filterAll' | 'filterHotel' | 'filterChalet' | 'filterCamp' }[] = [
  { key: 'all', labelKey: 'filterAll' },
  { key: 'hotel', labelKey: 'filterHotel' },
  { key: 'chalet', labelKey: 'filterChalet' },
  { key: 'camp', labelKey: 'filterCamp' },
]

// Lucide glyphs, not the ACCOMMODATION_TAGS emoji — emoji render inconsistently
// across platforms and carry no brand colour; these do.
const TYPE_ICON: Record<AccommodationType, LucideIcon> = {
  hotel: Hotel,
  chalet: Home,
  camp: Tent,
}

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
          {TYPE_FILTERS.map((f) => {
            const Icon = f.key === 'all' ? null : TYPE_ICON[f.key]
            const selected = filterType === f.key
            return (
              <Chip
                key={f.key}
                selected={selected}
                onClick={() => setFilterType(f.key)}
                icon={Icon ? <Icon className="h-3.5 w-3.5" /> : undefined}
              >
                {/*
                  Chip's own `count` prop renders a raw number with no locale
                  formatting — that badge is rebuilt here, inside a flex span
                  of our own, so it shows Arabic-Indic digits on the Arabic
                  page instead of "3"/"1".
                */}
                <span className="inline-flex items-center gap-1.5">
                  {t(`list.${f.labelKey}`)}
                  {f.key !== 'all' && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs font-bold tabular-nums',
                        selected ? 'bg-white/20' : 'bg-sand-200 text-ink-subtle',
                      )}
                    >
                      {formatCount(counts[f.key], locale)}
                    </span>
                  )}
                </span>
              </Chip>
            )
          })}
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

      <ResultCount
        count={sorted.length}
        label={t('list.resultCount', { count: sorted.length, n: formatCount(sorted.length, locale) })}
        className="mb-5"
      />

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
