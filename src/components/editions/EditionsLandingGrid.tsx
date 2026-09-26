'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { EditionCategory, PublicEdition } from '@/lib/editions'
import { EditionFilters } from '@/components/editions/EditionFilters'
import { EditionCard } from '@/components/editions/EditionCard'

type Props = {
  bookable: PublicEdition[]
  comingSoon: PublicEdition[]
  locale: 'en' | 'ar'
}

/**
 * Client-side category filter over the two server-fetched lists — filtering
 * never re-fetches, it only narrows what's already public/visible.
 */
export function EditionsLandingGrid({ bookable, comingSoon, locale }: Props) {
  const t = useTranslations('editions')
  const [category, setCategory] = useState<EditionCategory | 'ALL'>('ALL')

  const filteredBookable = useMemo(
    () => (category === 'ALL' ? bookable : bookable.filter((e) => e.category === category)),
    [bookable, category],
  )
  const filteredComingSoon = useMemo(
    () => (category === 'ALL' ? comingSoon : comingSoon.filter((e) => e.category === category)),
    [comingSoon, category],
  )

  return (
    <div className="space-y-12">
      <EditionFilters active={category} onChange={setCategory} />

      {filteredBookable.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold text-sea-900">{t('landing.upcomingTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('landing.upcomingSubtitle')}</p>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredBookable.map((edition) => (
              <EditionCard key={edition.id} edition={edition} locale={locale} />
            ))}
          </div>
        </section>
      )}

      {filteredComingSoon.length > 0 && (
        <section>
          <h2 className="font-display text-2xl font-bold text-sea-900">{t('landing.comingTitle')}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t('landing.comingBody')}</p>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredComingSoon.map((edition) => (
              <EditionCard key={edition.id} edition={edition} locale={locale} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
