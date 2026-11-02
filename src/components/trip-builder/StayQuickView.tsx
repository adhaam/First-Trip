'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Eye, X } from 'lucide-react'
import { PriceTag } from '@/components/brand'
import { HotelGallery } from '@/components/stays/HotelMedia'
import { Sheet, SheetClose, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { stayQuickViewData } from '@/lib/trip-builder/stay-quick-view'
import type { CatalogAccommodation } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'

/**
 * The "View" action on a stay card: opens a lightweight, read-only panel
 * with the accommodation's real photos, description and amenities, and a
 * "Select this stay" CTA that performs the same selection the card itself
 * would. Renders as a bottom sheet on small screens and a centered dialog
 * on larger ones (both the same underlying base-ui Dialog primitive, which
 * already provides focus trapping and Esc-to-close).
 */
export function StayQuickView({
  stay,
  locale,
  active,
  onSelect,
}: {
  stay: CatalogAccommodation
  locale: 'ar' | 'en'
  active: boolean
  onSelect: () => void
}) {
  const t = useTranslations('builder')
  const [open, setOpen] = useState(false)
  const data = stayQuickViewData(stay, locale)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setOpen(true)
        }}
        aria-label={t('stayView')}
        className="inline-flex min-h-8 items-center gap-1 rounded-full border-[1.5px] border-sand-300 px-2.5 py-1 text-xs font-semibold text-sea-900 transition-colors hover:border-sea-900/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        {t('stayView')}
      </button>
      {/*
        Mobile: the stock bottom sheet. From `sm` up it becomes a dialog centred
        with `inset-0` + auto margins instead of start/translate offsets, so it
        is direction-agnostic (the old start-1/2 + translate pair lost to the
        sheet's higher-specificity data-[side=bottom] insets and pushed the
        panel past the right edge in RTL). The `!` overrides beat those insets.
      */}
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-t-3xl border-sand-300 bg-sand-50 p-0 sm:inset-0! sm:m-auto sm:h-fit sm:max-h-[min(85vh,48rem)] sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:rounded-3xl sm:border-[1.5px]"
      >
        <SheetTitle className="sr-only">{data.name}</SheetTitle>
        <SheetClose
          aria-label={t('close')}
          className="absolute end-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-sand-50/95 text-sea-900 shadow-sm backdrop-blur transition-colors hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
        >
          <X className="h-5 w-5" aria-hidden />
        </SheetClose>
        <div className="flex-1 overflow-y-auto">
          <StayQuickViewGallery images={data.images} name={data.name} />
          <div className="space-y-4 p-5">
            <p className="font-display text-lg font-bold leading-snug text-sea-900">{data.name}</p>
            {data.description && <p className="text-sm leading-relaxed text-ink-subtle">{data.description}</p>}
            {data.amenities.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('stayQuickViewAmenities')}</p>
                <ul className="flex flex-wrap gap-1.5">
                  {data.amenities.map((amenity) => (
                    <li key={amenity} className="rounded-full bg-sand-200 px-2.5 py-1 text-xs font-medium text-sea-900">{amenity}</li>
                  ))}
                </ul>
              </div>
            )}
            <PriceTag amount={data.fromPricePerPersonPerNight} from unit="personNight" size="md" />
          </div>
        </div>
        <div className="border-t border-sand-200 bg-sand-50 p-4">
          <button
            type="button"
            onClick={() => {
              onSelect()
              setOpen(false)
            }}
            className={cn(
              'flex min-h-11 w-full items-center justify-center rounded-full border-[1.5px] px-4 text-sm font-semibold transition-colors',
              active ? 'border-sea-900 bg-sea-900 text-sand-50' : 'border-sea-900 text-sea-900 hover:bg-sea-900 hover:text-sand-50',
            )}
          >
            {active ? t('stayQuickViewSelected') : t('stayQuickViewSelect')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function StayQuickViewGallery({ images, name }: { images: string[]; name: string }) {
  return (
    <HotelGallery
      images={images}
      alt={name}
      aspect={4 / 3}
      tone="dark"
      compact
      sizes="(max-width: 640px) 100vw, 28rem"
    />
  )
}
