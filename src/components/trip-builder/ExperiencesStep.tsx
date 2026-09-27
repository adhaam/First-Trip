'use client'

import { type Dispatch, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Info, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SafeImage } from '@/components/SafeImage'
import { Chip, ChipRail } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import { filterTripsByCategory, packageIncludedSummary, tripCategories } from '@/lib/trip-builder/experiences'
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
  const [notices, setNotices] = useState<string[]>([])
  const categories = useMemo(() => tripCategories(catalog.trips), [catalog.trips])
  const trips = useMemo(() => filterTripsByCategory(catalog.trips, category), [catalog.trips, category])
  const isSelected = (kind: 'trip' | 'trip_package', id: string) => Boolean(state.experiences?.some((item) => item.kind === kind && item.id === id))
  const selectedPackageIds = useMemo(() => new Set(
    (state.experiences ?? []).filter((item) => item.kind === 'trip_package').map((item) => item.id),
  ), [state.experiences])
  const selectedPackages = useMemo(
    () => catalog.packages.filter((pkg) => selectedPackageIds.has(pkg.id)),
    [catalog.packages, selectedPackageIds],
  )

  const containingPackage = (tripId: string) => selectedPackages.find((pkg) => pkg.trip_ids.includes(tripId))

  // Repair older saved drafts / URL prefills that may already contain an
  // overlap before this step mounts. The server repeats this normalization.
  useEffect(() => {
    const overlaps = (state.experiences ?? []).flatMap((item) => {
      if (item.kind !== 'trip') return []
      const pkg = selectedPackages.find((candidate) => candidate.trip_ids.includes(item.id))
      const trip = catalog.trips.find((candidate) => candidate.id === item.id)
      return pkg && trip ? [{ trip, pkg }] : []
    })
    if (!overlaps.length) return
    for (const { trip } of overlaps) dispatch({ type: 'removeExperience', kind: 'trip', id: trip.id })
  }, [catalog.trips, dispatch, selectedPackages, state.experiences])

  const togglePackage = (pkg: CatalogPackage) => {
    if (isSelected('trip_package', pkg.id)) {
      dispatch({ type: 'toggleExperience', kind: 'trip_package', id: pkg.id })
      setNotices([])
      return
    }
    const overlappingTrips = (state.experiences ?? [])
      .filter((item) => item.kind === 'trip' && pkg.trip_ids.includes(item.id))
      .map((item) => catalog.trips.find((trip) => trip.id === item.id))
      .filter((trip): trip is BuilderCatalog['trips'][number] => Boolean(trip))
    for (const trip of overlappingTrips) {
      dispatch({ type: 'removeExperience', kind: 'trip', id: trip.id })
    }
    dispatch({ type: 'toggleExperience', kind: 'trip_package', id: pkg.id })
    const packageName = locale === 'ar' ? pkg.name_ar : pkg.name_en
    setNotices(overlappingTrips.map((trip) => t('overlapRemoved', {
      trip: locale === 'ar' ? trip.name_ar : trip.name_en,
      package: packageName,
    })))
  }

  if (!catalog.trips.length && !catalog.packages.length) {
    return <EmptyState variant="curating" title={t('experiencesEmpty')} hint={t('experiencesEmptyHint')} />
  }

  return (
    <div className="min-w-0 space-y-6">
      {notices.length > 0 && (
        <div role="status" className="space-y-1 rounded-xl border border-sun-600/30 bg-sun-50 p-3 text-sm text-sea-900">
          {notices.map((notice) => <p key={notice} className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden /><span>{notice}</span></p>)}
        </div>
      )}
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
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {trips.map((trip) => {
              const pkg = containingPackage(trip.id)
              return <ExperienceCard
                key={trip.id}
                image={trip.image}
                title={locale === 'ar' ? trip.name_ar : trip.name_en}
                meta={`${locale === 'ar' ? trip.duration_ar : trip.duration_en} · ${formatAmount(trip.price, locale)} ${common('egp')}`}
                selected={isSelected('trip', trip.id)}
                includedInPackage={pkg ? (locale === 'ar' ? pkg.name_ar : pkg.name_en) : undefined}
                onToggle={() => dispatch({ type: 'toggleExperience', kind: 'trip', id: trip.id })}
              />
            })}
          </div>
        </div>
      )}

      {catalog.packages.length > 0 && (
        <div>
          <p className="mb-2.5 text-sm font-semibold text-sea-900">{t('experiencesPackages')}</p>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {catalog.packages.map((pkg) => (
              <PackageCard key={pkg.id} pkg={pkg} trips={catalog.trips} locale={locale} selected={isSelected('trip_package', pkg.id)} onToggle={() => togglePackage(pkg)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ExperienceCard({ image, title, meta, selected, includedInPackage, onToggle }: { image: string; title: string; meta: string; selected: boolean; includedInPackage?: string; onToggle: () => void }) {
  const t = useTranslations('builder')
  return (
    <div className={cn('grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border-[1.5px] p-3 min-[380px]:grid-cols-[4rem_minmax(0,1fr)_auto]', selected || includedInPackage ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white')}>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-200 min-[380px]:h-16 min-[380px]:w-16">
        {image && <SafeImage src={image} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words font-display text-sm font-bold leading-snug text-sea-900">{title}</p>
        <p className="break-words text-xs leading-snug text-ink-subtle">{meta}</p>
        {selected && <p className="mt-0.5 text-xs font-medium text-sun-700">{t('dateArranged')}</p>}
        {includedInPackage && <p className="mt-1 text-xs font-semibold text-sun-800">{t('includedInPackage', { package: includedInPackage })}</p>}
      </div>
      <ToggleButton selected={selected} included={Boolean(includedInPackage)} onToggle={onToggle} name={title} />
    </div>
  )
}

function PackageCard({ pkg, trips, locale, selected, onToggle }: { pkg: CatalogPackage; trips: BuilderCatalog['trips']; locale: 'ar' | 'en'; selected: boolean; onToggle: () => void }) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const total = pkg.public_total ?? pkg.package_total
  const included = packageIncludedSummary(pkg, trips, locale)
  return (
    <div className={cn('grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border-[1.5px] p-3 min-[380px]:grid-cols-[4rem_minmax(0,1fr)_auto]', selected ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white')}>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-200 min-[380px]:h-16 min-[380px]:w-16">
        {pkg.image && <SafeImage src={pkg.image} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-block max-w-full break-words rounded-full bg-sun-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase leading-tight tracking-wide text-sun-800">
          {t('packageCardBadge')}
        </span>
        <p className="mt-1 break-words font-display text-sm font-bold leading-snug text-sea-900">{locale === 'ar' ? pkg.name_ar : pkg.name_en}</p>
        {included.names.length > 0 && (
          <p className="truncate text-xs text-ink-subtle">
            {included.names.join(' · ')}
            {included.extra > 0 ? ` ${t('packageIncludesExtra', { extra: included.extra })}` : ''}
          </p>
        )}
        <p className="break-words text-xs text-ink-subtle">{total != null ? `${formatAmount(total, locale)} ${common('egp')}` : ''}</p>
        {selected && <p className="mt-0.5 text-xs font-medium text-sun-700">{t('dateArranged')}</p>}
      </div>
      <ToggleButton selected={selected} onToggle={onToggle} name={locale === 'ar' ? pkg.name_ar : pkg.name_en} />
    </div>
  )
}

function ToggleButton({ selected, included = false, onToggle, name }: { selected: boolean; included?: boolean; onToggle: () => void; name: string }) {
  const t = useTranslations('builder')
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={included ? t('alreadyIncluded', { name }) : selected ? t('removeItem', { name }) : t('addItem', { name })}
      onClick={onToggle}
      disabled={included}
      className={cn(
        'col-span-2 flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border-[1.5px] px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600 min-[380px]:col-span-1 min-[380px]:w-auto',
        selected ? 'border-sea-900 bg-sea-900 text-sand-50' : included ? 'border-sun-600/40 bg-sun-100 text-sun-900' : 'border-sand-300 text-sea-900 hover:border-sea-900/40',
      )}
    >
      {selected || included ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
      {included ? t('included') : selected ? t('added') : t('add')}
    </button>
  )
}
