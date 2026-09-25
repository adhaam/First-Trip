'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight, BedDouble, Route } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { PriceTag } from '@/components/brand'
import { cn } from '@/lib/utils'
import { packageLane } from '@/lib/explore'
import { formatCount } from '@/lib/format'
import type { TripPackage } from '@/lib/types'

const LANE_ICON = { stay: BedDouble, experience: Route } as const

/**
 * `stay` and `experience` are never the same product wearing different copy
 * (BRIEF.md: "always label and style them distinctly") — the border and
 * badge accent switch on the package's real `payment_kind`-derived lane, via
 * `packageLane()`, so a card can never disagree with the lane index groups
 * it into.
 */
export function TripPackageCard({ pkg, className }: { pkg: TripPackage; className?: string }) {
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
    <GlowCard className={cn('h-full', className)}>
      <Link
        href={`/sinai-trips/packages/${pkg.slug}`}
        aria-label={`${t('explorePackage')}: ${name}`}
        className="block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3"
      >
        <article
          className={cn(
            'hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] bg-card pin-card',
            lane === 'stay' ? 'border-sand-300' : 'border-sun-300',
          )}
        >
          <div className="relative aspect-[3/2] overflow-hidden">
            <Image
              src={cover}
              alt={name}
              fill
              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent" />

            <span
              className={cn(
                'absolute start-3 top-3 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[0.7rem] font-semibold text-on-accent shadow',
                lane === 'stay' ? 'bg-sea-700' : 'bg-sun-500',
              )}
            >
              <LaneIcon className="h-3 w-3" aria-hidden />
              {badge}
            </span>

            <span className="absolute end-3 top-3 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
              {t('packageTripsCount', { count: tripNames.length, n: formatCount(tripNames.length, locale) })}
            </span>

            <div className="absolute inset-x-4 bottom-3">
              <h3 className="font-display text-lg font-bold leading-snug text-white drop-shadow">{name}</h3>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-5">
            {tripNames.length > 0 && (
              <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">{tripNames.join(' · ')}</p>
            )}

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <PriceTag amount={total} unit="person" size="md" />
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
