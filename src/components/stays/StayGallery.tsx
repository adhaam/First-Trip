'use client'

import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Expand } from 'lucide-react'
import { SafeImage as Image } from '@/components/SafeImage'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ArrowBack, ChevronForward } from '@/components/brand/DirectionalIcon'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'

const SWIPE_THRESHOLD = 40

/**
 * The stay detail gallery — full-bleed hero strip with thumbnails, a
 * keyboard- and swipe-navigable full-screen view, and a live photo counter
 * for screen readers. Pulled out of ProductDetailClient so the rest of the
 * detail page can stay presentational; this is the one part of the page with
 * real interaction state.
 */
export function StayGallery({ images, name }: { images: string[]; name: string }) {
  const t = useTranslations('stays')
  const locale = useLocale()
  const [index, setIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const go = useCallback((direction: 1 | -1) => {
    setIndex((i) => (i + direction + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, go])

  function onTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  function onTouchEnd(e: TouchEvent) {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > SWIPE_THRESHOLD) go(dx > 0 ? -1 : 1)
    touchStartX.current = null
  }

  if (images.length === 0) return null

  const counter = t('gallery.counter', {
    current: formatCount(index + 1, locale),
    total: formatCount(images.length, locale),
  })

  return (
    <section aria-label={t('gallery.label')} className="relative bg-sea-900">
      <div
        className="relative aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[21/9]"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <Image key={images[index]} src={images[index]} alt={name} fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/10 to-sea-900/35" />

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t('gallery.expand')}
          className="absolute end-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400"
        >
          <Expand className="h-4 w-4" />
        </button>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('gallery.previous')}
              className="absolute start-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400"
            >
              <ArrowBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('gallery.next')}
              className="absolute end-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30 sm:inline-flex focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400"
            >
              <ChevronForward className="h-5 w-5" />
            </button>
            <span
              aria-live="polite"
              className="absolute bottom-4 end-4 z-10 rounded-full bg-sea-900/60 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur"
            >
              {counter}
            </span>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-4 pt-3 sm:px-6 lg:px-8">
          {images.map((img, i) => (
            <button
              key={img + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`${i + 1}`}
              aria-current={i === index}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all',
                i === index ? 'ring-2 ring-sun-400 ring-offset-2 ring-offset-sea-900' : 'opacity-55 hover:opacity-100',
              )}
            >
              <Image src={img} alt="" fill sizes="96px" className="object-cover" />
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton
          className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 bg-sea-900 p-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{name}</DialogTitle>
          <div
            className="relative flex h-full w-full items-center justify-center"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <Image src={images[index]} alt={name} fill sizes="100vw" className="object-contain" />

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={t('gallery.previous')}
                  className="absolute start-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
                >
                  <ArrowBack className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={t('gallery.next')}
                  className="absolute end-4 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition-colors hover:bg-white/30"
                >
                  <ChevronForward className="h-6 w-6" />
                </button>
                <span
                  aria-live="polite"
                  className="absolute bottom-6 start-1/2 z-10 -translate-x-1/2 rounded-full bg-sea-900/70 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur"
                >
                  {counter}
                </span>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  )
}
