'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Eye } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { PriceTag } from '@/components/brand'
import { ArrowBack, ChevronForward } from '@/components/brand/DirectionalIcon'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { stayQuickViewData } from '@/lib/trip-builder/stay-quick-view'
import type { CatalogAccommodation } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'

const SWIPE_THRESHOLD = 40

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
      <SheetContent
        side="bottom"
        closeLabel={t('close')}
        className="flex max-h-[90vh] flex-col overflow-hidden rounded-t-3xl border-sand-300 bg-sand-50 p-0 sm:inset-x-auto sm:bottom-auto sm:start-1/2 sm:top-1/2 sm:h-auto sm:max-h-[85vh] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl sm:border-[1.5px] rtl:sm:translate-x-1/2"
      >
        <SheetTitle className="sr-only">{data.name}</SheetTitle>
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
  const t = useTranslations('builder')
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)

  const go = useCallback((direction: 1 | -1) => {
    setIndex((i) => (i + direction + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [go])

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx > 0 ? -1 : 1)
    touchStartX.current = null
  }

  if (images.length === 0) {
    return <div aria-hidden className="aspect-[4/3] w-full bg-sand-200" />
  }

  return (
    <div
      className="relative aspect-[4/3] w-full bg-sea-900"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <SafeImage key={images[index]} src={images[index]} alt={name} fill sizes="(max-width: 640px) 100vw, 28rem" className="object-cover" />
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={t('stayQuickViewGalleryPrevious')}
            className="absolute start-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400"
          >
            <ArrowBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={t('stayQuickViewGalleryNext')}
            className="absolute end-3 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400"
          >
            <ChevronForward className="h-5 w-5" />
          </button>
          <span
            aria-live="polite"
            className="absolute bottom-3 end-3 z-10 rounded-full bg-sea-900/60 px-2.5 py-1 text-[0.65rem] font-semibold tabular-nums text-white backdrop-blur"
          >
            {t('stayQuickViewGalleryCounter', { current: index + 1, total: images.length })}
          </span>
        </>
      )}
    </div>
  )
}
