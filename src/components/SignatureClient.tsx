'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { Chip, ChipRail } from '@/components/brand/Chip'
import { SignatureExperienceCard } from '@/components/cards/SignatureExperienceCard'
import { EmptyState } from '@/components/EmptyState'
import type { Experience, ExperienceCategory } from '@/lib/types'

/** Seeded as a real experience_categories row (migration 018) purely so the
 * admin can order/label it, but it is a CTA, not a filterable taxonomy
 * entry — the dedicated invitation panel below the grid covers it with its
 * own copy, so it is excluded from the chip row rather than doubled up. */
const BUILD_CATEGORY_SLUG = 'build-your-signature'

export function SignatureClient({
  categories,
  experiences,
}: {
  categories: ExperienceCategory[]
  experiences: Experience[]
}) {
  const t = useTranslations('signatureV2')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<string>('all')

  const filterableCategories = useMemo(
    () => categories.filter((cat) => cat.slug !== BUILD_CATEGORY_SLUG),
    [categories],
  )
  const filtered = filter === 'all' ? experiences : experiences.filter((e) => e.category === filter)

  if (experiences.length === 0) {
    return <EmptyState variant="curating" title={t('noExperiences')} />
  }

  return (
    <div id="experiences">
      {filterableCategories.length > 0 && (
        <ChipRail className="mb-8">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            {t('categoryAll')}
          </Chip>
          {filterableCategories.map((cat) => (
            <Chip key={cat.slug} selected={filter === cat.slug} onClick={() => setFilter(cat.slug)}>
              {ar ? cat.label_ar : cat.label_en}
            </Chip>
          ))}
        </ChipRail>
      )}

      {filtered.length === 0 ? (
        <EmptyState variant="no-results" title={t('noExperienceMatches')} onClear={() => setFilter('all')} />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((exp, i) => (
            <Reveal
              key={exp.id}
              delay={(i % 9) * 60}
              className={i === 0 ? 'sm:col-span-2' : undefined}
            >
              <SignatureExperienceCard experience={exp} size={i === 0 ? 'lg' : 'md'} priority={i === 0} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
