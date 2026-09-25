'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Star, MapPin, Hotel, Home, Tent, type LucideIcon } from 'lucide-react'
import { ACCOMMODATION_TAGS } from '@/lib/constants'
import { fromPricePerPersonPerNight } from '@/lib/stays'
import { GlowCard } from '@/components/motion/Reveal'
import { PriceTag } from '@/components/brand/PriceTag'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { cn } from '@/lib/utils'
import type { Accommodation, AccommodationType } from '@/lib/types'

// Lucide glyphs, not the ACCOMMODATION_TAGS emoji — emoji render inconsistently
// across platforms and carry no brand colour; these do.
const TYPE_ICON: Record<AccommodationType, LucideIcon> = {
  hotel: Hotel,
  chalet: Home,
  camp: Tent,
}

/**
 * The one card shape used for accommodations everywhere they're browsed
 * (Book Dahab list, home page rail, related stays). Kept to the same
 * `{ acc, className, priority }` API the whole codebase already calls it
 * with — see HomeClient.tsx and RelatedPlaces.tsx — while the inside is
 * rebuilt on the V2 brand primitives (PriceTag, directional arrow).
 */
export function AccommodationCard({
  acc,
  className,
  priority = false,
}: {
  acc: Accommodation
  className?: string
  priority?: boolean
}) {
  const t = useTranslations('stays')
  const locale = useLocale()
  const ar = locale === 'ar'

  const tag = ACCOMMODATION_TAGS[acc.type]
  const TypeIcon = TYPE_ICON[acc.type]
  const cover = acc.image_url || acc.images?.[0] || '/media/heroposter.webp'
  const fromRate = fromPricePerPersonPerNight(acc)
  const name = ar ? acc.name_ar : acc.name_en
  const location = ar ? acc.location_ar || acc.location : acc.location_en || acc.location

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link
        href={`/book-dahab/${acc.id}`}
        aria-label={`${t('card.viewStay')}: ${name}`}
        className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card transition-colors hover:border-sea-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-500"
      >
        <div className="slow-zoom relative aspect-[4/3] overflow-hidden">
          <Image
            src={cover}
            alt={name}
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"
            priority={priority}
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sea-900/60 via-transparent to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-95" />

          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
            <TypeIcon className="h-3.5 w-3.5" aria-hidden />
            {ar ? tag?.label_ar : tag?.label_en}
          </span>

          {acc.type === 'hotel' && acc.rating > 0 && (
            <span className="absolute end-3 top-3 flex gap-0.5 rounded-full bg-sea-900/70 px-2 py-1 backdrop-blur">
              {Array.from({ length: acc.rating }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-sun-300 text-sun-300" />
              ))}
            </span>
          )}

          {location && (
            <span className="absolute bottom-3 start-3 inline-flex items-center gap-1 text-xs font-medium text-white/95">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h3 className="font-display text-lg font-bold leading-snug text-sea-900">{name}</h3>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {ar ? acc.description_ar : acc.description_en}
          </p>

          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <PriceTag amount={fromRate} from unit="personNight" size="md" />

            <span
              aria-hidden
              className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-md bg-sand-100 px-3 text-xs font-semibold text-sea-900 transition-all duration-300 group-hover:bg-sun-400 group-hover:text-on-accent"
            >
              {t('card.viewStay')}
              <ArrowForward className="h-4 w-4" />
            </span>
          </div>
        </div>
      </Link>
    </GlowCard>
  )
}
