'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight, Route } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { PriceTag } from '@/components/brand'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format'
import type { TripPackage } from '@/lib/types'
import { NEUTRAL_MEDIA } from '@/lib/media'

/**
 * One consistent "Sinai trip package" card — a `TripPackage` is a single
 * public product (real Sinai trips bundled at a better total, picked up
 * from the guest's Dahab stay), never split into a "stay" vs "experience"
 * kind (`payment_kind` is an internal payment classification the M1 layer
 * is narrowing to always `'experience_package'` — see docs/m2/BRIEF.md
 * "Package semantics"). Every package renders with the same treatment.
 */
export function TripPackageCard({
  pkg,
  className,
  featured = false,
}: {
  pkg: TripPackage
  className?: string
  featured?: boolean
}) {
  const t = useTranslations('explore')
  const locale = useLocale()
  const ar = locale === 'ar'

  const name = ar ? pkg.name_ar : pkg.name_en
  const badge = (ar ? pkg.badge_ar : pkg.badge_en) || t('packageBadge')
  const cover = pkg.image || pkg.trips?.[0]?.image || NEUTRAL_MEDIA
  const tripNames = (pkg.trips || []).map((tr) => (ar ? tr.name_ar : tr.name_en))
  const short = ar ? pkg.short_description_ar : pkg.short_description_en
  const publicTotal = pkg.totals?.publicTotal ?? 0
  const total = pkg.totals?.packageTotal ?? 0
  const savings = pkg.totals?.savings ?? 0
  const previewNames = tripNames.slice(0, 3)
  const moreCount = Math.max(0, tripNames.length - previewNames.length)

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link
        href={`/sinai-trips/packages/${pkg.slug}`}
        aria-label={`${t('explorePackage')}: ${name}`}
        className="block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3"
      >
        <article className={cn(
          'hover-lift group h-full overflow-hidden border-[1.5px] border-sun-300 bg-card pin-card',
          featured ? 'grid sm:grid-cols-[1.12fr_1fr]' : 'flex flex-col',
        )}>
          <div className={cn('relative overflow-hidden', featured ? 'aspect-[3/2] sm:aspect-auto sm:min-h-[25rem]' : 'aspect-[3/2]')}>
            <Image
              src={cover}
              alt={name}
              fill
              sizes={featured ? '(max-width: 640px) 100vw, 55vw' : '(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw'}
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent" />

            <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-sun-500 px-3 py-1 text-[0.7rem] font-semibold text-on-accent shadow">
              <Route className="h-3 w-3" aria-hidden />
              {badge}
            </span>

            <span className="absolute end-3 top-3 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
              {t('packageTripsCount', { count: tripNames.length, n: formatCount(tripNames.length, locale) })}
            </span>

            {!featured && (
              <div className="absolute inset-x-4 bottom-3">
                <h3 className="font-display text-lg font-bold leading-snug text-white drop-shadow">{name}</h3>
              </div>
            )}
          </div>

          <div className={cn('flex flex-1 flex-col', featured ? 'justify-center p-6 sm:p-8' : 'p-5')}>
            {featured && <h3 className="font-display text-2xl font-bold leading-snug text-sea-900">{name}</h3>}
            {short && <p className={cn('text-sm leading-relaxed text-ink-muted', featured ? 'mt-3' : '')}>{short}</p>}

            {featured && pkg.slug === 'first-time-in-dahab' && (
              <p className="mt-4 text-sm font-semibold uppercase tracking-[0.13em] text-sun-700">
                {t('featuredPackageCue')}
              </p>
            )}

            {previewNames.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm leading-snug text-sea-900">
                {previewNames.map((tripName) => <li key={tripName}>{tripName}</li>)}
                {moreCount > 0 && (
                  <li className="font-semibold text-sun-700">{t('moreExperiences', { count: formatCount(moreCount, locale) })}</li>
                )}
              </ul>
            )}

            <div className="mt-auto pt-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-ink-muted">
                    {t('bookedSeparately')}{' '}
                    <span className="tabular-nums line-through">{publicTotal.toLocaleString(locale)} {t('egp')}</span>
                  </p>
                  <PriceTag amount={total} unit="person" size={featured ? 'lg' : 'md'} />
                  <p className="mt-1 text-sm font-bold text-sun-700">
                    {t('saveAmount', { amount: savings.toLocaleString(locale) })}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-sun-600 px-4 py-2 text-xs font-semibold text-sun-700 transition-colors group-hover:bg-sun-500 group-hover:text-on-accent">
                  {t('explorePackage')}
                  <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
                </span>
              </div>
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
