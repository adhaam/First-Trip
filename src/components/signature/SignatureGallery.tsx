'use client'

import { useCallback, useEffect, useState } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { ArrowBack, ArrowForward } from '@/components/brand/DirectionalIcon'

/**
 * The full gallery grid (below the header cover) plus a keyboard-navigable
 * lightbox. Adapted from the read-only `feat/signature-experiences` branch's
 * `ExperienceGallery` for today's schema — that branch used `next/image`
 * directly and a plain `<img>`-less approach; here we route through
 * `SafeImage` like every other image in this codebase, and drop its
 * `ItineraryDay`-shaped props since Signature Experiences here store a flat
 * `gallery: string[]`.
 */
export function SignatureGallery({ images, title }: { images: string[]; title: string }) {
  const t = useTranslations('signatureV2')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const close = useCallback(() => setOpenIndex(null), [])
  const step = useCallback(
    (delta: number) =>
      setOpenIndex((current) => (current === null ? current : (current + delta + images.length) % images.length)),
    [images.length],
  )

  useEffect(() => {
    if (openIndex === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      if (event.key === 'ArrowRight') step(1)
      if (event.key === 'ArrowLeft') step(-1)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [openIndex, close, step])

  if (images.length === 0) return null

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((src, index) => (
          <li key={`${src}-${index}`}>
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              aria-label={t('galleryOpen', { index: index + 1 })}
              className="group relative block aspect-[4/3] w-full overflow-hidden pin-card bg-sand-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2"
            >
              <Image
                src={src}
                alt={`${title} ${index + 1}`}
                fill
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('gallery')}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-sea-900/95 p-4"
        >
          <button
            type="button"
            onClick={close}
            aria-label={t('galleryClose')}
            className="absolute top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 end-4"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label={t('galleryPrevious')}
                className="absolute top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 start-4"
              >
                <ArrowBack className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label={t('galleryNext')}
                className="absolute top-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 end-4"
              >
                <ArrowForward className="h-6 w-6" />
              </button>
            </>
          )}

          <figure className="relative h-full max-h-[80vh] w-full max-w-4xl">
            <Image src={images[openIndex]} alt={`${title} ${openIndex + 1}`} fill sizes="100vw" className="object-contain" priority />
            <figcaption className="absolute inset-x-0 -bottom-8 text-center text-sm text-sand-200">
              {openIndex + 1} / {images.length}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  )
}
