'use client'

import { useLocale, useTranslations } from 'next-intl'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import type { TripPackage } from '@/lib/types'

export function TripPackageRail({ packages }: { packages: TripPackage[] }) {
  const t = useTranslations('sinai')
  const locale = useLocale()
  const ar = locale === 'ar'

  if (packages.length === 0) return null

  return (
    <section className="my-10 rounded-3xl border-[1.5px] border-sun-300 bg-gradient-to-br from-sun-50 to-sand-50 p-6 md:p-8">
      <div className="mb-6 max-w-2xl">
        <span className="eyebrow mb-2 text-sun-600">
          <span aria-hidden className="h-px w-6 bg-current" />
          {ar ? 'باكدجات WEEMAP' : 'WEEMAP Packages'}
        </span>
        <h2 className="font-display text-2xl font-bold text-sea-900 sm:text-3xl">{t('packagesTitle')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-sea-900/60">{t('packagesDescription')}</p>
      </div>

      <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
        {packages.map((pkg) => (
          <div key={pkg.id} className="w-[85%] shrink-0 snap-start sm:w-[360px]">
            <TripPackageCard pkg={pkg} />
          </div>
        ))}
      </div>
    </section>
  )
}
