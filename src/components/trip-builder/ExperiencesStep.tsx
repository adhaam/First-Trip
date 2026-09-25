'use client'

import { type Dispatch, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SafeImage } from '@/components/SafeImage'
import { Chip, ChipRail } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import { filterTripsByCategory, tripCategories } from '@/lib/trip-builder/experiences'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState, CatalogPackage } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'

/** Section 6 (optional) — trips and packages the visitor can add to the plan. */
export function ExperiencesStep({
  state,
  catalog,
  locale,
  dispatch,
}: {
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  dispatch: Dispatch<BuilderAction>
}) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const [category, setCategory] = useState<string | null>(null)
  const categories = useMemo(() => tripCategories(catalog.trips), [catalog.trips])
  const trips = useMemo(() => filterTripsByCategory(catalog.trips, category), [catalog.trips, category])
  const isSelected = (kind: 'trip' | 'trip_package', id: string) => Boolean(state.experiences?.some((item) => item.kind === kind && item.id === id))

  if (!catalog.trips.length && !catalog.packages.length) {
    return <EmptyState variant="curating" title={t('experiencesEmpty')} hint={t('experiencesEmptyHint')} />
  }

  return (
    <div className="space-y-6">
      {catalog.trips.length > 0 && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('experiencesTrips')}</p>
          {categories.length > 1 && (
            <ChipRail className="mb-3">
              <Chip selected={category === null} onClick={() => setCategory(null)}>{t('experiencesAllCategories')}</Chip>
              {categories.map((item) => (
                <Chip key={item.slug} selected={category === item.slug} onClick={() => setCategory(item.slug)}>
                  {locale === 'ar' ? item.name_ar : item.name_en}
                </Chip>
              ))}
            </ChipRail>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {trips.map((trip) => (
              <ExperienceCard
                key={trip.id}
                image={trip.image}
                title={locale === 'ar' ? trip.name_ar : trip.name_en}
                meta={`${locale === 'ar' ? trip.duration_ar : trip.duration_en} · ${formatAmount(trip.price, locale)} ${common('egp')}`}
                selected={isSelected('trip', trip.id)}
                onToggle={() => dispatch({ type: 'toggleExperience', kind: 'trip', id: trip.id })}
              />
            ))}
          </div>
        </div>
      )}

      {catalog.packages.length > 0 && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('experiencesPackages')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {catalog.packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} locale={locale} selected={isSelected('trip_package', pkg.id)} onToggle={() => dispatch({ type: 'toggleExperience', kind: 'trip_package', id: pkg.id })} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExperienceCard({ image, title, meta, selected, onToggle }: { image: string; title: string; meta: string; selected: boolean; onToggle: () => void }) {
  const t = useTranslations('builder')
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border-[1.5px] p-3', selected ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white')}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-200">
        {image && <SafeImage src={image} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-sea-900">{title}</p>
        <p className="text-xs text-ink-subtle">{meta}</p>
        {selected && <p className="mt-0.5 text-xs font-medium text-sun-700">{t('dateArranged')}</p>}
      </div>
      <ToggleButton selected={selected} onToggle={onToggle} name={title} />
    </div>
  )
}

function PackageCard({ pkg, locale, selected, onToggle }: { pkg: CatalogPackage; locale: 'ar' | 'en'; selected: boolean; onToggle: () => void }) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const total = pkg.public_total ?? pkg.package_total
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border-[1.5px] p-3', selected ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white')}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sand-200">
        {pkg.image && <SafeImage src={pkg.image} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className={cn('inline-block rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide', pkg.payment_kind === 'stay_package' ? 'bg-sea-100 text-sea-800' : 'bg-sun-100 text-sun-800')}>
          {pkg.payment_kind === 'stay_package' ? t('stayPackage') : t('experiencePackage')}
        </span>
        <p className="mt-1 truncate font-display text-sm font-bold text-sea-900">{locale === 'ar' ? pkg.name_ar : pkg.name_en}</p>
        <p className="text-xs text-ink-subtle">{total != null ? `${formatAmount(total, locale)} ${common('egp')}` : ''}</p>
        {selected && <p className="mt-0.5 text-xs font-medium text-sun-700">{t('dateArranged')}</p>}
      </div>
      <ToggleButton selected={selected} onToggle={onToggle} name={locale === 'ar' ? pkg.name_ar : pkg.name_en} />
    </div>
  )
}

function ToggleButton({ selected, onToggle, name }: { selected: boolean; onToggle: () => void; name: string }) {
  const t = useTranslations('builder')
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={selected ? t('removeItem', { name }) : t('addItem', { name })}
      onClick={onToggle}
      className={cn(
        'flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600',
        selected ? 'border-sea-900 bg-sea-900 text-sand-50' : 'border-sand-300 text-sea-900 hover:border-sea-900/40',
      )}
    >
      {selected ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
      {selected ? t('added') : t('add')}
    </button>
  )
}
