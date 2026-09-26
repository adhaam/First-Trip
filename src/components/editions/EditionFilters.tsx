'use client'

import { useTranslations } from 'next-intl'
import { EDITION_CATEGORIES, type EditionCategory } from '@/lib/editions'

type Props = {
  active: EditionCategory | 'ALL'
  onChange: (value: EditionCategory | 'ALL') => void
}

/** Category filter pills — All | Learn | Retreat | Adventure | Music & Events | Special Editions. */
export function EditionFilters({ active, onChange }: Props) {
  const t = useTranslations('editions')
  const options: (EditionCategory | 'ALL')[] = ['ALL', ...EDITION_CATEGORIES]

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={t('landing.upcomingTitle')}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          aria-pressed={active === option}
          className={
            active === option
              ? 'rounded-full bg-sea-900 px-4 py-2 text-sm font-semibold text-white'
              : [
                  'rounded-full border border-sand-300 px-4 py-2 text-sm font-semibold',
                  'text-ink-muted hover:border-sea-400',
                ].join(' ')
          }
        >
          {option === 'ALL' ? t('filters.all') : t(`filters.${option}`)}
        </button>
      ))}
    </div>
  )
}
