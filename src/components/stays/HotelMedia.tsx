'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type TouchEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Expand, X } from 'lucide-react'
import { SafeImage } from '@/components/SafeImage'
import { ArrowBack, ArrowForward } from '@/components/brand/DirectionalIcon'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { formatCount } from '@/lib/format'
import { decideMediaFit, normalizeGalleryImages } from '@/lib/media-fit'
import { NEUTRAL_MEDIA } from '@/lib/media'
import { cn } from '@/lib/utils'

/**
 * Adaptive hotel photography.
 *
 * - `HotelPhoto`      one photo in a frame; picks cover / contain per photo
 *                     (see src/lib/media-fit.ts), never stretches, falls back to
 *                     the neutral media when the URL is broken.
 * - `HotelCoverImage` HotelPhoto preset for 4:3 cards (fills its parent).
 * - `HotelGallery`    main frame + thumbnails (or dots in `compact` mode) +
 *                     prev/next + counter + full-screen viewer, RTL-aware.
 *
 * Contained photos sit on a blurred, darkened copy of themselves. Photos with
 * far fewer pixels than the frame needs are never blown up: they are contained
 * at their natural size at most. Both states are exposed as data attributes on
 * the frame (`data-fit`, `data-low-res`, `data-natural-size`) so QA / admin
 * tooling can find photos that deserve a human replacement.
 */

const DEFAULT_ASPECT = 4 / 3
const SWIPE_THRESHOLD = 40
const MAX_DOTS = 8

function isRtlDocument(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
}

// ─── HotelPhoto ─────────────────────────────────────────────────────────────

export interface HotelPhotoProps {
  src: string
  /** Alt text. Pass "" for purely decorative thumbnails. */
  alt: string
  /**
   * Frame width / height. Pass `'fill'` to fill a positioned parent instead
   * (the fit decision then uses the parent's measured size).
   */
  aspect?: number | 'fill'
  /** Classes for the frame (rounding, responsive aspect overrides, background...). */
  className?: string
  /** Classes for the <img> (e.g. hover transforms). */
  imageClassName?: string
  /** Passed straight to next/image. */
  sizes?: string
  /** Above-the-fold photo: loads eagerly. Everything else is lazy. */
  priority?: boolean
  /** `contain` forces the whole photo to be visible (full-screen viewer). */
  fit?: 'auto' | 'contain'
  onLoadedSize?: (size: { width: number; height: number }) => void
}

interface Measured {
  src: string
  width: number
  height: number
}

export function HotelPhoto({
  src,
  alt,
  aspect = DEFAULT_ASPECT,
  className,
  imageClassName,
  sizes,
  priority = false,
  fit = 'auto',
  onLoadedSize,
}: HotelPhotoProps) {
  const t = useTranslations('stays')
  const frameRef = useRef<HTMLDivElement>(null)
  const [frame, setFrame] = useState<{ width: number; height: number } | null>(null)
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [failedSrc, setFailedSrc] = useState<string | null>(null)

  useEffect(() => {
    const el = frameRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const next = { width: Math.round(width), height: Math.round(height) }
      setFrame((prev) => (prev && prev.width === next.width && prev.height === next.height ? prev : next))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // A photo that finished loading (or failing) before hydration never fires React's onLoad/onError
  // — typical for priority, cached and server-rendered images — so read its state once mounted.
  useEffect(() => {
    const img = frameRef.current?.querySelector<HTMLImageElement>('img[data-hotel-photo="main"]')
    if (!img || !img.complete || src === NEUTRAL_MEDIA) return
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setMeasured((prev) => (prev?.src === src ? prev : { src, width: img.naturalWidth, height: img.naturalHeight }))
    } else {
      setFailedSrc(src)
    }
  }, [src])

  const broken = failedSrc === src
  const isNeutral = src === NEUTRAL_MEDIA
  const shownSrc = broken ? NEUTRAL_MEDIA : src
  const shownAlt = broken ? (alt ? `${alt} — ${t('gallery.unavailable')}` : t('gallery.unavailable')) : alt

  const frameAspect =
    frame && frame.width > 0 && frame.height > 0 ? frame.width / frame.height : typeof aspect === 'number' ? aspect : DEFAULT_ASPECT
  const natural = !broken && !isNeutral && measured?.src === src ? measured : null
  const decision = decideMediaFit({
    naturalWidth: natural?.width,
    naturalHeight: natural?.height,
    frameAspect,
    renderedWidth: frame?.width,
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
  })
  const contained = natural !== null && (fit === 'contain' || decision.mode === 'contain')
  const lowRes = natural !== null && decision.lowRes

  // Low-res: natural size at most, centred; never stretched or upscaled. The size goes on a wrapper
  // box, never on the image: next/image rejects a width/height style on a `fill` image and throws,
  // which took the whole hotel page down to its error boundary.
  const lowResBox: CSSProperties | undefined =
    lowRes && natural
      ? { width: natural.width, height: natural.height, maxWidth: '100%', maxHeight: '100%' }
      : undefined

  return (
    <div
      ref={frameRef}
      data-fit={contained ? 'contain' : 'cover'}
      data-low-res={lowRes ? 'true' : undefined}
      data-natural-size={natural ? `${natural.width}x${natural.height}` : undefined}
      data-photo-state={broken ? 'broken' : undefined}
      // A custom property so responsive classes can retune it (`sm:[--hotel-aspect:1.5]`).
      style={typeof aspect === 'number' ? { aspectRatio: `var(--hotel-aspect, ${aspect})` } : undefined}
      className={cn(
        'relative isolate overflow-hidden bg-sand-200',
        aspect === 'fill' ? 'absolute inset-0' : 'w-full',
        className,
      )}
    >
      {contained && (
        <SafeImage
          src={shownSrc}
          alt=""
          aria-hidden
          fill
          sizes="96px"
          className="scale-125 object-cover blur-2xl brightness-50 saturate-125"
        />
      )}
      <div className="absolute inset-0 m-auto" style={lowResBox}>
        <SafeImage
          src={shownSrc}
          alt={shownAlt}
          fill
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : 'lazy'}
          data-hotel-photo="main"
          className={cn(contained ? 'object-contain' : 'object-cover', imageClassName)}
          onLoad={(event) => {
            if (broken) return
            const img = event.currentTarget
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              setMeasured({ src, width: img.naturalWidth, height: img.naturalHeight })
              onLoadedSize?.({ width: img.naturalWidth, height: img.naturalHeight })
            }
          }}
          onError={() => {
            if (!isNeutral) setFailedSrc(src)
          }}
        />
      </div>
    </div>
  )
}

/**
 * Card preset: fills a positioned parent that already owns the 4:3 aspect and
 * the clipping (`relative aspect-[4/3] overflow-hidden`). Missing sources use
 * the neutral media. Contained photos get the blurred backdrop, so cards stay
 * visually consistent whatever the supplier uploaded.
 */
export function HotelCoverImage({
  src,
  alt,
  sizes,
  priority = false,
  className,
  imageClassName,
}: {
  src: string | null | undefined
  alt: string
  sizes?: string
  priority?: boolean
  className?: string
  imageClassName?: string
}) {
  return (
    <HotelPhoto
      src={src && src.trim() ? src : NEUTRAL_MEDIA}
      alt={alt}
      aspect="fill"
      sizes={sizes}
      priority={priority}
      className={className}
      imageClassName={imageClassName}
    />
  )
}

// ─── Interaction hooks ──────────────────────────────────────────────────────

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/** "Next" follows the reading direction: ArrowLeft advances in RTL. */
function arrowDirection(key: string): 1 | -1 | null {
  if (key !== 'ArrowLeft' && key !== 'ArrowRight') return null
  const rtl = isRtlDocument()
  const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
  return key === forward ? 1 : -1
}

function useWindowArrowKeys(enabled: boolean, go: (direction: 1 | -1) => void) {
  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return
      const direction = arrowDirection(event.key)
      if (direction) go(direction)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [enabled, go])
}

/** Horizontal swipe; the direction flips in RTL so a swipe always moves "with the reading flow". */
function useSwipe(go: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0]
      start.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    },
    onTouchEnd(event: TouchEvent) {
      const origin = start.current
      start.current = null
      const touch = event.changedTouches[0]
      if (!origin || !touch) return
      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (Math.abs(dx) <= SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return
      // Dragging content towards the start edge reveals the next photo:
      // leftwards in LTR, rightwards in RTL.
      const towardsNext = isRtlDocument() ? dx > 0 : dx < 0
      go(towardsNext ? 1 : -1)
    },
  }
}

// ─── HotelGallery ───────────────────────────────────────────────────────────

export interface HotelGalleryProps {
  /** Ordered photo URLs; index 0 is the cover. Duplicates and empties are dropped. */
  images: ReadonlyArray<string | null | undefined>
  /** Hotel name, used as the base for every photo's alt text. */
  alt: string
  /** Main frame aspect (width / height). Responsive overrides: `frameClassName="sm:[--hotel-aspect:1.5]"`. */
  aspect?: number
  className?: string
  frameClassName?: string
  /** `dark` for galleries sitting on a sea-900 surface. */
  tone?: 'light' | 'dark'
  sizes?: string
  /** Main photo is above the fold. */
  priority?: boolean
  /** No thumbnail strip; dots + counter instead (for sheets and quick views). */
  compact?: boolean
  /** Called whenever the visible photo changes (not on first render). */
  onIndexChange?: (index: number) => void
}

const CONTROL_BUTTON =
  'inline-flex h-11 w-11 items-center justify-center rounded-full bg-sea-900/55 text-white backdrop-blur transition-colors hover:bg-sea-900/75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400'

export function HotelGallery({
  images,
  alt,
  aspect = DEFAULT_ASPECT,
  className,
  frameClassName,
  tone = 'light',
  sizes = '100vw',
  priority = false,
  compact = false,
  onIndexChange,
}: HotelGalleryProps) {
  const t = useTranslations('stays')
  const locale = useLocale()
  const list = useMemo(() => normalizeGalleryImages(images), [images])
  const count = list.length
  const [index, setIndex] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const thumbsRef = useRef<HTMLDivElement>(null)
  const current = count > 0 ? Math.min(index, count - 1) : 0

  const go = useCallback(
    (direction: 1 | -1) => {
      if (count < 2) return
      setIndex((i) => (Math.min(i, count - 1) + direction + count) % count)
    },
    [count],
  )

  const notified = useRef(0)
  useEffect(() => {
    if (notified.current === current) return
    notified.current = current
    onIndexChange?.(current)
  }, [current, onIndexChange])

  // The viewer owns the keyboard while open; compact galleries (quick view) keep
  // listening on the window as before; the full gallery handles keys on itself.
  useWindowArrowKeys(viewerOpen || (compact && count > 1), go)

  // Keep the active thumbnail in view — scrolls the strip only, never the page
  // (and not on first paint). `scrollBy` is direction-agnostic, so it is RTL-safe.
  const stripMoved = useRef(false)
  useEffect(() => {
    const strip = thumbsRef.current
    const active = strip?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!strip || !active) return
    if (!stripMoved.current) {
      stripMoved.current = true
      return
    }
    const a = active.getBoundingClientRect()
    const s = strip.getBoundingClientRect()
    const delta = a.left + a.width / 2 - (s.left + s.width / 2)
    strip.scrollBy({ left: delta, behavior: 'smooth' })
  }, [current])

  const swipe = useSwipe(go)

  function onSectionKeyDown(event: ReactKeyboardEvent) {
    if (compact || viewerOpen || event.altKey || event.ctrlKey || event.metaKey || isEditableTarget(event.target)) return
    const direction = arrowDirection(event.key)
    if (direction) {
      event.preventDefault()
      go(direction)
    }
  }

  if (count === 0) {
    return (
      <div className={className}>
        <HotelPhoto src={NEUTRAL_MEDIA} alt={alt} aspect={aspect} sizes={sizes} className={frameClassName} />
      </div>
    )
  }

  const src = list[current]
  const multiple = count > 1
  const counter = t('gallery.counter', { current: formatCount(current + 1, locale), total: formatCount(count, locale) })
  const photoAlt = multiple
    ? t('gallery.photoAlt', { name: alt, current: formatCount(current + 1, locale), total: formatCount(count, locale) })
    : alt
  const dark = tone === 'dark'

  return (
    <section aria-label={t('gallery.label')} className={className} onKeyDown={onSectionKeyDown}>
      <div className="relative touch-pan-y" onTouchStart={swipe.onTouchStart} onTouchEnd={swipe.onTouchEnd}>
        <HotelPhoto
          key={src}
          src={src}
          alt={photoAlt}
          aspect={aspect}
          sizes={sizes}
          priority={priority}
          className={cn(dark ? 'bg-sea-900' : 'bg-sand-200', frameClassName)}
        />

        {/* Whole frame opens the viewer; the chip below is only its visual cue. */}
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setViewerOpen(true)}
          aria-label={t('gallery.expand')}
          className="absolute inset-0 z-[1] cursor-zoom-in focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-sun-400"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute end-3 top-3 z-[2] inline-flex h-9 w-9 items-center justify-center rounded-full bg-sea-900/55 text-white backdrop-blur"
        >
          <Expand className="h-4 w-4" />
        </span>

        {multiple && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t('gallery.previous')}
              className={cn(CONTROL_BUTTON, 'absolute start-3 top-1/2 z-[2] -translate-y-1/2')}
            >
              <ArrowBack className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t('gallery.next')}
              className={cn(CONTROL_BUTTON, 'absolute end-3 top-1/2 z-[2] -translate-y-1/2')}
            >
              <ArrowForward className="h-5 w-5" />
            </button>
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-3 end-3 z-[2] rounded-full bg-sea-900/60 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur"
            >
              {counter}
            </span>
            {compact && count <= MAX_DOTS && (
              <span aria-hidden className="pointer-events-none absolute bottom-4 start-1/2 z-[2] flex -translate-x-1/2 gap-1.5 rtl:translate-x-1/2">
                {list.map((item, i) => (
                  <span key={item} className={cn('h-1.5 rounded-full bg-white transition-all', i === current ? 'w-4' : 'w-1.5 opacity-60')} />
                ))}
              </span>
            )}
          </>
        )}
      </div>

      {multiple && (
        <span role="status" aria-live="polite" className="sr-only">
          {counter}
        </span>
      )}

      {multiple && !compact && (
        <div ref={thumbsRef} className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3 pt-3 sm:px-0">
          {list.map((item, i) => (
            <button
              key={item}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t('gallery.showPhoto', { number: formatCount(i + 1, locale) })}
              aria-current={i === current}
              className={cn(
                'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-400',
                i === current
                  ? cn('ring-2 ring-sun-400 ring-offset-2', dark ? 'ring-offset-sea-900' : 'ring-offset-sand-50')
                  : 'opacity-60 hover:opacity-100',
              )}
            >
              <HotelPhoto src={item} alt="" aspect="fill" sizes="96px" className={dark ? 'bg-white/10' : undefined} />
            </button>
          ))}
        </div>
      )}

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent
          showCloseButton={false}
          finalFocus={triggerRef}
          className="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-sea-900 p-0 ring-0 sm:max-w-none"
        >
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          <DialogClose aria-label={t('gallery.close')} className={cn(CONTROL_BUTTON, 'absolute end-4 top-4 z-20')}>
            <X className="h-5 w-5" aria-hidden />
          </DialogClose>
          <div
            className="relative h-full w-full touch-pan-y"
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            <HotelPhoto
              key={src}
              src={src}
              alt={photoAlt}
              aspect="fill"
              fit="contain"
              sizes="100vw"
              priority
              className="bg-sea-900"
            />
            {multiple && (
              <>
                <button
                  type="button"
                  onClick={() => go(-1)}
                  aria-label={t('gallery.previous')}
                  className={cn(CONTROL_BUTTON, 'absolute start-4 top-1/2 z-10 -translate-y-1/2')}
                >
                  <ArrowBack className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  aria-label={t('gallery.next')}
                  className={cn(CONTROL_BUTTON, 'absolute end-4 top-1/2 z-10 -translate-y-1/2')}
                >
                  <ArrowForward className="h-6 w-6" />
                </button>
                <span
                  aria-hidden
                  className="pointer-events-none absolute bottom-6 start-1/2 z-10 -translate-x-1/2 rounded-full bg-sea-900/70 px-3 py-1 text-xs font-semibold tabular-nums text-white backdrop-blur rtl:translate-x-1/2"
                >
                  {counter}
                </span>
                <span role="status" aria-live="polite" className="sr-only">
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
