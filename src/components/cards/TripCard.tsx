'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Clock, ArrowUpRight, Check } from 'lucide-react'
import { PLACEHOLDER_IMAGES, WHATSAPP_NUMBER } from '@/lib/constants'
import { GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import type { SinaiTrip } from '@/lib/types'

export function TripCard({
  trip,
  className,
  whatsapp,
  includesLabel,
}: {
  trip: SinaiTrip
  className?: string
  whatsapp?: string | null
  /** Pass a label to show the first 3 "includes" items — omit on compact/home cards. */
  includesLabel?: string
}) {
  const common = useTranslations('common')
  const sinai = useTranslations('sinai')
  const locale = useLocale()
  const ar = locale === 'ar'

  const name = ar ? trip.name_ar : trip.name_en
  const cover = trip.images?.[0] || PLACEHOLDER_IMAGES.desert1
  const duration = ar ? trip.duration : trip.duration_en || trip.duration
  const category = ar ? trip.category_ar : trip.category_en
  const digits = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const message = encodeURIComponent(
    ar ? `عايز أحجز رحلة: ${name}` : `I'd like to book: ${name}`,
  )

  return (
    <GlowCard className={cn('h-full', className)}>
      <article className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-white pin-card">
        <div className="relative aspect-[3/2] overflow-hidden">
          <Image
            src={cover}
            alt={name}
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"
            className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sea-900/60 to-transparent" />

          {category && (
            <span className="absolute start-3 top-3 rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
              {category}
            </span>
          )}

          <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-2">
            <h3 className="font-display text-lg font-bold leading-snug text-white drop-shadow">
              {name}
            </h3>
            {duration && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sea-900/70 px-2.5 py-1 text-[0.7rem] font-medium text-white backdrop-blur">
                <Clock className="h-3 w-3" />
                {duration}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <p className="line-clamp-2 text-sm leading-relaxed text-sea-900/60">
            {ar ? trip.description_ar : trip.description_en}
          </p>

          {includesLabel && (ar ? trip.includes_ar : trip.includes_en)?.length > 0 && (
            <div className="mt-4 border-t border-sand-200 pt-4">
              <div className="mb-2 text-[0.7rem] font-semibold uppercase tracking-wider text-sea-900/45">
                {includesLabel}
              </div>
              <ul className="space-y-1">
                {(ar ? trip.includes_ar : trip.includes_en).slice(0, 3).map((inc, idx) => (
                  <li key={idx} className="flex items-center gap-1.5 text-xs text-sea-900/55">
                    <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                    <span className="truncate">{inc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 pt-5">
            <div className="font-display text-lg font-extrabold text-sea-900">
              {Number(trip.price).toLocaleString()}{' '}
              <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
            </div>
            <a
              href={`https://wa.me/${digits}?text=${message}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-sea-900 px-4 py-2 text-xs font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50"
            >
              {sinai('bookNow')}
              <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
            </a>
          </div>
        </div>
      </article>
    </GlowCard>
  )
}
