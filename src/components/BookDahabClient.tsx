'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Accommodation } from '@/lib/types'

export function BookDahabClient({ accommodations }: { accommodations: Accommodation[] }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('default')

  const filtered = accommodations.filter((a) => filterType === 'all' || a.type === filterType)

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price_per_night - b.price_per_night
    if (sortBy === 'price-desc') return b.price_per_night - a.price_per_night
    return 0
  })

  const filters = [
    { key: 'all', label_ar: 'الكل', label_en: 'All' },
    { key: 'hotel', label_ar: '🏨 فنادق', label_en: '🏨 Hotels' },
    { key: 'chalet', label_ar: '🏖️ شاليهات', label_en: '🏖️ Chalets' },
    { key: 'camp', label_ar: '🏕️ كمبات', label_en: '🏕️ Camps' },
  ]

  const sorts = [
    { key: 'default', label_ar: 'الافتراضي', label_en: 'Default' },
    { key: 'price-asc', label_ar: 'السعر ↑', label_en: 'Price ↑' },
    { key: 'price-desc', label_ar: 'السعر ↓', label_en: 'Price ↓' },
  ]

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-sand-300 bg-white p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
                filterType === f.key
                  ? 'bg-sea-900 text-sand-50'
                  : 'text-sea-900/60 hover:text-sea-900',
              )}
            >
              {ar ? f.label_ar : f.label_en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-full border border-sand-300 bg-white p-1">
          <ArrowUpDown className="mx-1.5 h-3.5 w-3.5 text-sea-900/35" />
          {sorts.map((s) => (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                sortBy === s.key
                  ? 'bg-sea-900 text-sand-50'
                  : 'text-sea-900/60 hover:text-sea-900',
              )}
            >
              {ar ? s.label_ar : s.label_en}
            </button>
          ))}
        </div>

        <span className="text-sm text-sea-900/40">
          {sorted.length} {ar ? 'مكان إقامة' : 'places'}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-20 text-center text-sea-900/40">
          {ar ? 'لا توجد أماكن إقامة متاحة حالياً' : 'No accommodations available right now'}
        </div>
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
