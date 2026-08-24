'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { ExperienceCard } from './ExperienceCard'
import type { ExperienceCategory, ExperienceWithDates } from '@/lib/experiences'

interface ExperiencesGridProps {
  experiences: ExperienceWithDates[]
  categories: ExperienceCategory[]
  whatsappNumber: string
}

export function ExperiencesGrid({ experiences, categories, whatsappNumber }: ExperiencesGridProps) {
  const t = useTranslations('experiences')
  const locale = useLocale()
  const [active, setActive] = useState<string>('all')

  const filtered = useMemo(
    () => (active === 'all' ? experiences : experiences.filter((e) => e.category === active)),
    [experiences, active],
  )

  if (!experiences.length) {
    return (
      <div className="rounded-2xl border border-dashed border-sand-300 bg-white/60 py-20 text-center">
        <p className="font-display text-lg text-sea-900/70">{t('empty')}</p>
      </div>
    )
  }

  return (
    <div>
      <div
        role="group"
        aria-label={t('filterBy')}
        className="mb-10 flex flex-wrap gap-2 border-b border-sand-200 pb-6"
      >
        <FilterChip label={t('all')} active={active === 'all'} onClick={() => setActive('all')} />
        {categories.map((category) => (
          <FilterChip
            key={category.slug}
            label={locale === 'ar' ? category.label_ar : category.label_en}
            active={active === category.slug}
            onClick={() => setActive(category.slug)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-sea-900/60">{t('emptyFilter')}</p>
      ) : (
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((experience) => (
            <ExperienceCard
              key={experience.id}
              experience={experience}
              categories={categories}
              whatsappNumber={whatsappNumber}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-10 rounded-full border px-4 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-500 focus-visible:ring-offset-2',
        active
          ? 'border-sea-700 bg-sea-700 text-white'
          : 'border-sand-300 bg-white text-sea-900/80 hover:border-sea-300 hover:text-sea-800',
      )}
    >
      {label}
    </button>
  )
}
