'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { ArrowUpDown, BedDouble } from 'lucide-react'
import { EmptyState, ResultCount } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import type { Accommodation } from '@/lib/types'

export function BookDahabClient({ accommodations }: { accommodations: Accommodation[] }) {
  const locale = useLocale()
  const states = useTranslations('states')
  const ar = locale === 'ar'
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('default')

  const filtered = accommodations.filter((a) => filterType === 'all' || a.type === filterType)

  /**
   * The card displays Math.min(single, double, triple) falling back to
   * price_per_night. Sort must use the same value so "Price ↑" is not
   * contradicted by what the customer reads on the card.
   * Zero/missing prices sort last.
   */
  function startingRate(a: Accommodation): number {
    const rates = [a.price_single_room, a.price_double_room, a.price_triple_room]
      .map(Number)
      .filter((p) => p > 0)
    return rates.length ? Math.min(...rates) : (Number(a.price_per_night) || 0)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      const pa = startingRate(a)
      const pb = startingRate(b)
      // Zero / missing → always last regardless of sort direction
      if (pa === 0 && pb === 0) return 0
      if (pa === 0) return 1
      if (pb === 0) return -1
      return sortBy === 'price-asc' ? pa - pb : pb - pa
    }
    // Default: preserve server order (sort_order ASC from getAccommodations)
    return 0
  })

  const filters = [
    { key: 'all', label_ar: 'الكل', label_en: 'All' },
    { key: 'hotel', label_ar: 'فنادق', label_en: 'Hotels' },
    { key: 'chalet', label_ar: 'شاليهات', label_en: 'Chalets' },
    { key: 'camp', label_ar: 'كمبات', label_en: 'Camps' },
  ]

  const sorts = [
    { key: 'default', label_ar: 'الافتراضي', label_en: 'Default' },
    { key: 'price-asc', label_ar: 'السعر ↑', label_en: 'Price ↑' },
    { key: 'price-desc', label_ar: 'السعر ↓', label_en: 'Price ↓' },
  ]

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-sand-300 bg-card p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilterType(f.key)}
              aria-pressed={filterType === f.key}
              className={cn(
                'min-h-11 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                filterType === f.key
                  ? 'bg-sea-900 text-sand-50'
                  : 'text-ink-muted hover:text-sea-900',
              )}
            >
              {ar ? f.label_ar : f.label_en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-sand-300 bg-card p-1">
          <ArrowUpDown className="mx-1.5 h-3.5 w-3.5 text-ink-subtle" />
          {sorts.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSortBy(s.key)}
              aria-pressed={sortBy === s.key}
              className={cn(
                'min-h-11 rounded-full px-3 py-2 text-xs font-medium transition-colors',
                sortBy === s.key
                  ? 'bg-sea-900 text-sand-50'
                  : 'text-ink-muted hover:text-sea-900',
              )}
            >
              {ar ? s.label_ar : s.label_en}
            </button>
          ))}
        </div>

        <ResultCount
          count={sorted.length}
          label={`${sorted.length} ${ar ? 'مكان إقامة' : 'places'}`}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          icon={<BedDouble className="h-8 w-8" />}
          title={accommodations.length === 0 ? states('noAccommodations') : states('noAccommodationMatches')}
          onClear={
            filterType !== 'all' || sortBy !== 'default'
              ? () => { setFilterType('all'); setSortBy('default') }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sorted.map((acc, i) => (
            <Reveal key={acc.id} delay={(i % 8) * 60} className="h-full">
              <AccommodationCard acc={acc} priority={i === 0} />
            </Reveal>
          ))}
        </div>
      )}
    </>
  )
}
