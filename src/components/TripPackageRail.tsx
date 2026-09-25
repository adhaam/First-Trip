'use client'

import type { ReactNode } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight, BedDouble, Route } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { PriceTag } from '@/components/brand'
import { packageLane } from '@/lib/explore'
import { formatCount } from '@/lib/format'
import type { TripPackage } from '@/lib/types'

const LANE_ICON = { stay: BedDouble, experience: Route } as const

/**
 * A titled shelf of packages — the single package, a rail, or a grid,
 * whichever fits `packages.length`. `title`/`lede` default to the generic
 * "two ways to bundle Sinai" copy, but a caller with a more specific reason
 * to show these particular packages (e.g. the trip detail cross-sell,
 * `packagesIncludingTrip`) can override both.
 */
export function TripPackageRail({
  packages,
  title,
  lede,
}: {
  packages: TripPackage[]
  title?: ReactNode
  lede?: ReactNode
}) {
  const t = useTranslations('explore')

  if (packages.length === 0) return null

  const heading = title ?? t('packagesTitle')
  const description = lede ?? t('packagesLede')
  const gridCols = packages.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <section className="my-8 rounded-3xl border-[1.5px] border-sun-300 bg-gradient-to-br from-sun-50 to-sand-50 p-5 md:p-8">
      <div className="mb-5 max-w-2xl">
        <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{heading}</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">{description}</p>
      </div>

      {packages.length === 1 ? (
        <FeaturedPackage pkg={packages[0]} />
      ) : (
        <div
          className={`no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 ${gridCols}`}
        >
          {packages.map((pkg) => (
            <div key={pkg.id} className="w-[85%] shrink-0 snap-start sm:w-auto sm:shrink">
              <TripPackageCard pkg={pkg} />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function FeaturedPackage({ pkg }: { pkg: TripPackage }) {
  const t = useTranslations('explore')
  const locale = useLocale()
  const ar = locale === 'ar'

  const lane = packageLane(pkg)
  const LaneIcon = LANE_ICON[lane]
  const name = ar ? pkg.name_ar : pkg.name_en
  const badge = (ar ? pkg.badge_ar : pkg.badge_en) || t(lane === 'stay' ? 'kindStay' : 'kindExperience')
  const cover = pkg.image || pkg.trips?.[0]?.image || '/media/heroposter.webp'
  const tripNames = (pkg.trips || []).map((tr) => (ar ? tr.name_ar : tr.name_en))
  const total = pkg.totals?.packageTotal ?? 0

  return (
    <GlowCard>
      <Link
        href={`/sinai-trips/packages/${pkg.slug}`}
        aria-label={`${t('explorePackage')}: ${name}`}
        className="block rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3"
      >
        <article className="hover-lift group grid overflow-hidden border-[1.5px] border-sun-300 bg-card pin-card sm:grid-cols-2">
          <div className="relative aspect-[3/2] overflow-hidden sm:aspect-auto sm:h-full">
            <Image
              src={cover}
              alt={name}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent" />

            <span
              className={`absolute start-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] font-semibold text-on-accent shadow ${lane === 'stay' ? 'bg-sea-700' : 'bg-sun-500'}`}
            >
              <LaneIcon className="h-3 w-3" aria-hidden />
              {badge}
            </span>

            <span className="absolute end-3 top-3 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
              {t('packageTripsCount', { count: tripNames.length, n: formatCount(tripNames.length, locale) })}
            </span>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <h3 className="font-display text-2xl font-bold leading-snug text-sea-900">{name}</h3>
            {tripNames.length > 0 && (
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">{tripNames.join(' · ')}</p>
            )}
            <div className="mt-6 flex items-center justify-between gap-3">
              <PriceTag amount={total} unit="person" size="lg" />
              <span className="inline-flex items-center gap-1.5 rounded-md border border-sun-600 px-4 py-2 text-xs font-semibold text-sun-700 transition-colors group-hover:bg-sun-500 group-hover:text-on-accent">
                {t('explorePackage')}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
