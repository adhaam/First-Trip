'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Star, MapPin, ArrowUpRight } from 'lucide-react'
import { ACCOMMODATION_TAGS, PLACEHOLDER_IMAGES } from '@/lib/constants'
import { GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import type { Accommodation } from '@/lib/types'

export function AccommodationCard({
  acc,
  className,
  priority = false,
}: {
  acc: Accommodation
  className?: string
  priority?: boolean
}) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const tag = ACCOMMODATION_TAGS[acc.type]
  const cover = acc.image_url || acc.images?.[0] || PLACEHOLDER_IMAGES.dahab1
  const name = ar ? acc.name_ar : acc.name_en
  const location = ar
    ? acc.location_ar || acc.location
    : acc.location_en || acc.location

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link
        href={`/book-dahab/${acc.id}`}
        className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-white pin-card transition-colors hover:border-sea-900/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-500"
      >
        <div className="relative aspect-[4/3] overflow-hidden">
          <Image
            src={cover}
            alt={name}
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 25vw"
            priority={priority}
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sea-900/55 via-transparent to-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-90" />

          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
            <span aria-hidden>{tag?.emoji}</span>
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
          <h3 className="font-display text-lg font-bold leading-snug text-sea-900">
            {name}
          </h3>

          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-sea-900/60">
            {ar ? acc.description_ar : acc.description_en}
          </p>

          <div className="mt-auto flex items-end justify-between gap-3 pt-5">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wider text-sea-900/45">
                {t('priceStartsFrom')}
              </div>
              <div className="font-display text-xl font-extrabold text-sea-900">
                {Number(acc.price_per_night).toLocaleString()}{' '}
                <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
              </div>
              <div className="text-[0.7rem] text-sea-900/45">
                {t('perNight')} · {t('perPerson')}
              </div>
            </div>

            <span
              aria-hidden
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-100 text-sea-900 transition-all duration-300 group-hover:bg-sun-400 group-hover:text-white"
            >
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </span>
          </div>
        </div>
      </Link>
    </GlowCard>
  )
}
