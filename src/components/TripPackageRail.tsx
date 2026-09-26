'use client'

import type { ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import type { TripPackage } from '@/lib/types'

/**
 * A titled shelf of packages — the single package, a rail, or a grid,
 * whichever fits `packages.length`. `title`/`lede` default to the generic
 * "Sinai trip packages" copy, but a caller with a more specific reason to
 * show these particular packages (e.g. the trip detail cross-sell,
 * `packagesIncludingTrip`) can override both. One consistent treatment —
 * see `TripPackageCard` on why there is no "stay" vs "experience" variant.
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
        <TripPackageCard pkg={packages[0]} featured />
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
