'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight, Layers } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import type { TripPackage } from '@/lib/types'

export function TripPackageRail({ packages }: { packages: TripPackage[] }) {
  const t = useTranslations('sinai')
  const locale = useLocale()
  const ar = locale === 'ar'

  if (packages.length === 0) return null

  const gridCols = packages.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <section className="my-8 rounded-3xl border-[1.5px] border-sun-300 bg-gradient-to-br from-sun-50 to-sand-50 p-5 md:p-8">
      <div className="mb-5 max-w-2xl">
        <span className="eyebrow mb-2 text-sun-600">
          <span aria-hidden className="h-px w-6 bg-current" />
          {ar ? 'باكدجات WEEMAP' : 'WEEMAP Packages'}
        </span>
        <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('packagesTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-sea-900/60">{t('packagesDescription')}</p>
      </div>

      {packages.length === 1 ? (
        <FeaturedPackage pkg={packages[0]} />
      ) : (
        <div className={`no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2 sm:mx-0 sm:grid sm:snap-none sm:overflow-visible sm:px-0 sm:pb-0 ${gridCols}`}>
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
  const common = useTranslations('common')
  const t = useTranslations('sinai')
  const locale = useLocale()
  const ar = locale === 'ar'

  const name = ar ? pkg.name_ar : pkg.name_en
  const badge = ar ? pkg.badge_ar : pkg.badge_en
  const cover = pkg.image || pkg.trips?.[0]?.image || '/media/heroposter.png'
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

            {badge && (
              <span className="absolute start-3 top-3 rounded-full bg-sun-500 px-3 py-1 text-[0.7rem] font-semibold text-white shadow">
                {badge}
              </span>
            )}

            <span className="absolute end-3 top-3 inline-flex items-center gap-1 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
              <Layers className="h-3 w-3" />
              {t('experiencesCount', { count: tripNames.length })}
            </span>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-8">
            <h3 className="font-display text-2xl font-bold leading-snug text-sea-900">{name}</h3>
            {tripNames.length > 0 && (
              <p className="mt-3 text-sm leading-relaxed text-sea-900/60">{tripNames.join(' · ')}</p>
            )}
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="font-display text-xl font-bold text-sea-900">
                {total.toLocaleString()}{' '}
                <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-sun-500 px-4 py-2 text-xs font-semibold text-sun-600 transition-colors group-hover:bg-sun-500 group-hover:text-white">
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
