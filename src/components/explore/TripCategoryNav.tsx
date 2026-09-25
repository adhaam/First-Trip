'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Chip, ChipRail } from '@/components/brand'
import type { TripCategoryChip } from '@/lib/trip-categories'

/**
 * The category chip row that drives `/sinai-trips`. Category is the page's
 * only filter dimension — not a secondary axis like Book Dahab's sort — so,
 * matching how Book Dahab keeps its primary type filter an always-visible
 * `<ChipRail>` on every breakpoint (FilterSheet there is reserved for the
 * secondary "sort" filter), it stays a persistent horizontal rail rather
 * than moving behind FilterSheet's tap-to-open trigger: the categories are
 * the main way to explore this page, so hiding them costs more than it
 * saves.
 */
export function TripCategoryNav({
  categories,
  selected,
  onSelect,
}: {
  categories: TripCategoryChip[]
  /** `'all'` or a category id, as resolved by `categoryFromSearchParam`. */
  selected: string
  onSelect: (categoryId: string) => void
}) {
  const t = useTranslations('explore')
  const locale = useLocale()
  const label = (category: Pick<TripCategoryChip, 'name_ar' | 'name_en'>) =>
    locale === 'ar' ? category.name_ar : category.name_en

  return (
    <ChipRail>
      <Chip selected={selected === 'all'} onClick={() => onSelect('all')}>
        {t('allTrips')}
      </Chip>
      {categories.map((category) => (
        <Chip key={category.id} selected={selected === category.id} onClick={() => onSelect(category.id)}>
          {label(category)}
        </Chip>
      ))}
    </ChipRail>
  )
}
