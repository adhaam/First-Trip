'use client'

import { type Dispatch, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Info, Plus } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { SafeImage } from '@/components/SafeImage'
import { Chip, ChipRail } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import { conflictingSelectedPackages, filterTripsByCategory, packageIncludedSummary, planPackageToggle, redundantStandaloneTrips, selectedPackageCovering, tripCategories } from '@/lib/trip-builder/experiences'
import type { BuilderAction } from '@/lib/trip-builder/state'
import type { BuilderCatalog, BuilderState, CatalogPackage } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'
import { PackageQuickView } from './PackageQuickView'

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
  const travellers = state.travellers_confirmed ? Math.max(1, state.adults ?? 1) + Math.max(0, state.children ?? 0) : undefined
  const tripName = (trip: BuilderCatalog['trips'][number]) => (locale === 'ar' ? trip.name_ar : trip.name_en)
  const joinNames = (names: string[]) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)

  // Repair older saved drafts / URL prefills that may already contain an
  // overlap before this step mounts. The server repeats this normalization.
  useEffect(() => {
    for (const trip of redundantStandaloneTrips(catalog.packages, catalog.trips, state.experiences)) {
      dispatch({ type: 'removeExperience', kind: 'trip', id: trip.id })
    }
  }, [catalog.packages, catalog.trips, dispatch, state.experiences])

  const togglePackage = (pkg: CatalogPackage) => {
    const plan = planPackageToggle(pkg, catalog.packages, catalog.trips, state.experiences)
    if (plan.mode === 'remove') {
      dispatch({ type: 'toggleExperience', kind: 'trip_package', id: pkg.id })
      setNotices([])
      return
    }
    // The quote engine rejects two selected packages that share an excursion.
    if (plan.blockedBy.length) return
    // Never charge twice: drop the standalone trips this package already includes.
    for (const trip of plan.removedTrips) dispatch({ type: 'removeExperience', kind: 'trip', id: trip.id })
    dispatch({ type: 'toggleExperience', kind: 'trip_package', id: pkg.id })
    setNotices(plan.removedTrips.length
      ? [t('packageQuickView.removedNotice', { trips: joinNames(plan.removedTrips.map(tripName)), package: locale === 'ar' ? pkg.name_ar : pkg.name_en })]
      : [])
  }

  if (!catalog.trips.length && !catalog.packages.length) {
    return <EmptyState variant="curating" title={t('experiencesEmpty')} hint={t('experiencesEmptyHint')} />
  }

  return (
    <div className="min-w-0 space-y-6">
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
              const pkg = selectedPackageCovering(trip.id, catalog.packages, state.experiences)
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
          {notices.length > 0 && (
            <div role="status" className="mb-3 space-y-1 rounded-xl border border-sun-600/30 bg-sun-50 p-3 text-sm text-sea-900">
              {notices.map((notice) => <p key={notice} className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden /><span>{notice}</span></p>)}
            </div>
          )}
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            {catalog.packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                catalog={catalog}
                experiences={state.experiences}
                travellers={travellers}
                locale={locale}
                selected={isSelected('trip_package', pkg.id)}
                onToggle={() => togglePackage(pkg)}
              />
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

function PackageCard({ pkg, catalog, experiences, travellers, locale, selected, onToggle }: { pkg: CatalogPackage; catalog: BuilderCatalog; experiences: BuilderState['experiences']; travellers?: number; locale: 'ar' | 'en'; selected: boolean; onToggle: () => void }) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  // The price the quote engine charges per person (the package page shows the same figure); the regular total is only a fallback.
  const total = pkg.package_total ?? pkg.public_total
  const included = packageIncludedSummary(pkg, catalog.trips, locale)
  const name = locale === 'ar' ? pkg.name_ar : pkg.name_en
  const conflicts = selected ? [] : conflictingSelectedPackages(pkg, catalog.packages, experiences)
  const conflictNames = new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(conflicts.map((other) => (locale === 'ar' ? other.name_ar : other.name_en)))
  return (
    <div className={cn('grid min-w-0 grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-2xl border-[1.5px] p-3 min-[380px]:grid-cols-[4rem_minmax(0,1fr)_auto]', selected ? 'border-sun-600 bg-sun-50' : 'border-sand-300 bg-white')}>
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-200 min-[380px]:h-16 min-[380px]:w-16">
        {pkg.image && <SafeImage src={pkg.image} alt="" fill sizes="64px" className="object-cover" />}
      </div>
      <div className="min-w-0 flex-1">
        <span className="inline-block max-w-full break-words rounded-full bg-sun-100 px-2 py-0.5 text-[0.6rem] font-bold uppercase leading-tight tracking-wide text-sun-800">
          {t('packageCardBadge')}
        </span>
        <p className="mt-1 break-words font-display text-sm font-bold leading-snug text-sea-900">{name}</p>
        {included.names.length > 0 && (
          <p className="truncate text-xs text-ink-subtle">
            {included.names.join(' · ')}
            {included.extra > 0 ? ` ${t('packageIncludesExtra', { extra: included.extra })}` : ''}
          </p>
        )}
        <p className="break-words text-xs text-ink-subtle">{total != null ? `${formatAmount(total, locale)} ${common('egp')}` : ''}</p>
        {selected && <p className="mt-0.5 text-xs font-medium text-sun-700">{t('dateArranged')}</p>}
        {conflicts.length > 0 && <p className="mt-0.5 text-xs font-medium text-sun-800">{t('packageQuickView.conflictShort', { packages: conflictNames })}</p>}
        <div className="mt-1.5">
          <PackageQuickView
            pkg={pkg}
            trips={catalog.trips}
            packages={catalog.packages}
            experiences={experiences}
            travellers={travellers}
            policies={catalog.paymentPolicies}
            locale={locale}
            selected={selected}
            onToggle={onToggle}
          />
        </div>
      </div>
      <ToggleButton selected={selected} blocked={conflicts.length > 0} onToggle={onToggle} name={name} />
    </div>
  )
}

function ToggleButton({ selected, included = false, blocked = false, onToggle, name }: { selected: boolean; included?: boolean; blocked?: boolean; onToggle: () => void; name: string }) {
  const t = useTranslations('builder')
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={included ? t('alreadyIncluded', { name }) : selected ? t('removeItem', { name }) : t('addItem', { name })}
      onClick={onToggle}
      disabled={included || blocked}
      className={cn(
        'col-span-2 flex min-h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-full border-[1.5px] px-3 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600 min-[380px]:col-span-1 min-[380px]:w-auto',
        selected ? 'border-sea-900 bg-sea-900 text-sand-50' : included ? 'border-sun-600/40 bg-sun-100 text-sun-900' : 'border-sand-300 text-sea-900 hover:border-sea-900/40',
        blocked && 'cursor-not-allowed opacity-50',
      )}
    >
      {selected || included ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
      {included ? t('included') : selected ? t('added') : t('add')}
    </button>
  )
}
