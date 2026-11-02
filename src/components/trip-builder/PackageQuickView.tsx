'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Check, Eye, Info, MapPin, X } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { PaymentTerms } from '@/components/brand'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { formatAmount } from '@/lib/format'
import { NEUTRAL_MEDIA } from '@/lib/media'
import { packageQuickViewData } from '@/lib/trip-builder/package-quick-view'
import type { ExperienceSelections } from '@/lib/trip-builder/experiences'
import type { CatalogPackage, CatalogTrip } from '@/lib/trip-builder/types'
import type { PaymentPolicy } from '@/lib/payment-rules'
import { cn } from '@/lib/utils'

/**
 * The "View details" action on a package card: a lightweight, read-only panel
 * listing everything the package contains (every excursion, not "+N"), the
 * price explanation and the Dahab pickup line, with an Add / Remove button that
 * runs the exact same toggle the card uses. Opening and closing it never
 * touches builder state. Bottom sheet on small screens, centred dialog from
 * `sm` up (same base-ui Dialog as StayQuickView: focus trap, Esc to close,
 * focus returns to the trigger).
 */
export function PackageQuickView({
  pkg,
  trips,
  packages,
  experiences,
  travellers,
  policies,
  locale,
  selected,
  onToggle,
}: {
  pkg: CatalogPackage
  trips: readonly CatalogTrip[]
  packages: readonly CatalogPackage[]
  experiences: ExperienceSelections | undefined
  /** Confirmed traveller count (adults + children); undefined until the customer confirms. */
  travellers?: number
  policies: PaymentPolicy[]
  locale: 'ar' | 'en'
  selected: boolean
  onToggle: () => void
}) {
  const t = useTranslations('builder.packageQuickView')
  const builder = useTranslations('builder')
  const explore = useTranslations('explore')
  const common = useTranslations('common')
  const [open, setOpen] = useState(false)
  const data = packageQuickViewData(pkg, trips, locale, { packages, experiences, travellers })
  const blocked = !selected && data.conflictingPackages.length > 0
  const removing = !selected ? data.coveredStandaloneTrips : []
  const currency = common('egp')
  const list = (names: string[]) => new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(names)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('viewDetailsFor', { name: data.name })}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border-[1.5px] border-sand-300 px-2.5 py-1 text-xs font-semibold text-sea-900 transition-colors hover:border-sea-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        {t('viewDetails')}
      </button>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-3xl border-sand-300 bg-sand-50 p-0 sm:inset-0! sm:m-auto sm:h-fit sm:max-h-[min(88vh,52rem)] sm:w-[calc(100vw-2rem)] sm:max-w-xl sm:rounded-3xl sm:border-[1.5px]"
      >
        <SheetTitle className="sr-only">{data.name}</SheetTitle>
        <SheetClose
          aria-label={builder('close')}
          className="absolute end-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/95 text-sea-900 shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
        >
          <X className="h-5 w-5" aria-hidden />
        </SheetClose>

        <div className="flex-1 overflow-y-auto">
          <div className="relative aspect-[16/9] w-full bg-sand-200">
            <SafeImage src={data.heroImage ?? NEUTRAL_MEDIA} alt={data.name} fill sizes="(max-width: 640px) 100vw, 36rem" className="object-cover" />
          </div>

          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <span className="inline-block rounded-full bg-sun-100 px-2 py-0.5 text-[0.65rem] font-bold uppercase leading-tight tracking-wide text-sun-800">
                {builder('packageCardBadge')}
              </span>
              {selected && <span className="ms-2 inline-block rounded-full bg-sea-900 px-2 py-0.5 text-[0.65rem] font-bold leading-tight text-sand-50">{t('inYourTrip')}</span>}
              <p className="break-words font-display text-lg font-bold leading-snug text-sea-900">{data.name}</p>
              {data.summary && <p className="text-sm font-medium leading-relaxed text-sea-900">{data.summary}</p>}
              {data.description && <p className="whitespace-pre-line text-sm leading-relaxed text-ink-subtle">{data.description}</p>}
            </div>

            {data.trips.length > 0 && (
              <section aria-label={t('tripsHeading', { count: data.trips.length })}>
                <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('tripsHeading', { count: data.trips.length })}</p>
                <ol className="space-y-2.5">
                  {data.trips.map((trip) => (
                    <li key={trip.id} className="grid grid-cols-[4rem_minmax(0,1fr)] gap-3 rounded-2xl border border-sand-300 bg-white p-3">
                      <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-sand-200">
                        <SafeImage src={trip.image ?? NEUTRAL_MEDIA} alt="" fill sizes="64px" className="object-cover" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <p className="break-words font-display text-sm font-bold leading-snug text-sea-900">{trip.name}</p>
                        {trip.duration && <p className="text-xs font-medium text-sun-800">{t('duration', { duration: trip.duration })}</p>}
                        {trip.description && <p className="break-words text-xs leading-relaxed text-ink-subtle">{trip.description}</p>}
                        {trip.includes.length > 0 && (
                          <div className="pt-0.5">
                            <p className="sr-only">{t('tripIncludes')}</p>
                            <ul className="flex flex-wrap gap-1">
                              {trip.includes.map((item) => (
                                <li key={item} className="flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[0.7rem] font-medium text-sea-900">
                                  <Check className="h-3 w-3 shrink-0 text-sun-700" aria-hidden />
                                  <span className="break-words">{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('pickupHeading')}</p>
              <p className="flex items-start gap-2 text-sm font-medium leading-5 text-sea-900">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden />
                {explore('pickup')}
              </p>
            </section>

            {data.packageTotal != null && (
              <section className="space-y-2 rounded-2xl border border-sand-300 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('priceHeading')}</p>
                <p className="font-display text-xl font-bold tabular-nums text-sea-900">
                  {t('perPerson', { amount: formatAmount(data.packageTotal, locale), currency })}
                </p>
                {data.savings != null && data.publicTotal != null && (
                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{explore('bookedSeparately')}</dt>
                      <dd className="tabular-nums line-through">{formatAmount(data.publicTotal, locale)} {currency}</dd>
                    </div>
                    <div className="flex justify-between gap-4 rounded-lg bg-sun-50 p-2 font-bold text-sun-700">
                      <dt>{explore('youSave')}</dt>
                      <dd className="tabular-nums">{formatAmount(data.savings, locale)} {currency}</dd>
                    </div>
                  </dl>
                )}
                <p className="text-sm text-ink-muted">
                  {data.travellers != null && data.groupTotal != null
                    ? t('priceExplain', { amount: formatAmount(data.packageTotal, locale), currency, travellers: data.travellers, total: formatAmount(data.groupTotal, locale) })
                    : t('priceExplainPending')}
                </p>
                <PaymentTerms kind="experience_package" policies={policies} />
              </section>
            )}

            {removing.length > 0 && (
              <p className="flex items-start gap-2 rounded-xl border border-sun-600/30 bg-sun-50 p-3 text-sm text-sea-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden />
                <span>{t('willRemove', { trips: list(removing.map((trip) => trip.name)) })}</span>
              </p>
            )}
            {blocked && (
              <p className="flex items-start gap-2 rounded-xl border border-sun-600/30 bg-sun-50 p-3 text-sm text-sea-900">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden />
                <span>{t('conflict', { packages: list(data.conflictingPackages.map((other) => other.name)) })}</span>
              </p>
            )}
          </div>
        </div>

        <div className="border-t border-sand-200 bg-sand-50 p-4">
          <button
            type="button"
            disabled={blocked}
            onClick={() => {
              onToggle()
              setOpen(false)
            }}
            className={cn(
              'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600 disabled:cursor-not-allowed disabled:opacity-50',
              selected ? 'border-sea-900 bg-sea-900 text-sand-50' : 'border-sea-900 text-sea-900 hover:bg-sea-900 hover:text-sand-50 disabled:hover:bg-transparent disabled:hover:text-sea-900',
            )}
          >
            {selected ? t('remove') : t('select')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
