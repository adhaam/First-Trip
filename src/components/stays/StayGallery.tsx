'use client'

import { HotelGallery } from '@/components/stays/HotelMedia'
import { normalizeGalleryImages } from '@/lib/media-fit'

/**
 * The stay detail gallery — a calm hero frame (4:3 on phones, 3:2 from `sm`)
 * with thumbnails and a keyboard-, swipe- and RTL-aware full-screen viewer.
 * All of the interaction and the per-photo cover/contain decision live in
 * HotelGallery; this is the detail page's dark, full-bleed presentation of it.
 */
export function StayGallery({ images, name }: { images: string[]; name: string }) {
  if (normalizeGalleryImages(images).length === 0) return null

  return (
    <div className="bg-sea-900">
      <HotelGallery
        images={images}
        alt={name}
        aspect={4 / 3}
        tone="dark"
        priority
        sizes="(min-width: 1024px) 64rem, 100vw"
        className="mx-auto w-full max-w-5xl sm:px-6 lg:px-8"
        frameClassName="max-h-[75vh] sm:[--hotel-aspect:1.5]"
      />
    </div>
  )
}
