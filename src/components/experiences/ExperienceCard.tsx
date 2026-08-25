'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowUpRight, CalendarDays, Clock, Users } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import {
  categoryLabel,
  formatDateRange,
  formatDuration,
  formatPrice,
  localized,
  nextAvailableDate,
  type ExperienceCategory,
  type ExperienceWithDates,
} from '@/lib/experiences'

interface ExperienceCardProps {
  experience: ExperienceWithDates
  categories: ExperienceCategory[]
  whatsappNumber: string
}

export function ExperienceCard({ experience, categories, whatsappNumber }: ExperienceCardProps) {
  const locale = useLocale()
  const t = useTranslations('experiences')
  const ar = locale === 'ar'

  const title = localized(experience, 'title', locale)
  const shortDescription = localized(experience, 'short_description', locale)
  const next = nextAvailableDate(experience.dates)
  const soldOut = Boolean(next && !next.is_bookable && next.spots_remaining <= 0)
  const price = next?.price_override ?? experience.price
  const duration = formatDuration(experience, next, locale)
  const cover = experience.hero_image || experience.gallery[0] || '/media/heroposter.png'

  const waText = encodeURIComponent(
    ar
      ? `عايز أنضم لقائمة الانتظار لتجربة: ${title}`
      : `I'd like to join the waitlist for: ${title}`,
  )
  const waHref = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${waText}`

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-sand-200 bg-white shadow-sm transition-shadow duration-300 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-sand-100">
        <Image
          src={cover}
          alt={title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-sea-900/70 to-transparent" />
        <span className="absolute top-4 rounded-full bg-sand-50/95 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sea-800 backdrop-blur-sm ltr:left-4 rtl:right-4">
          {categoryLabel(experience.category, categories, locale)}
        </span>
        {soldOut && (
          <span className="absolute top-4 rounded-full bg-sea-900/90 px-3 py-1 text-[11px] font-semibold text-sand-100 ltr:right-4 rtl:left-4">
            {t('soldOut')}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        {experience.partner_name && (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-sun-600">
            {t('withPartner', { partner: experience.partner_name })}
          </p>
        )}
        <h3 className="font-display text-xl font-bold leading-snug text-sea-900">
          <Link
            href={`/experiences/${experience.slug}`}
            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea-500"
          >
            {title}
          </Link>
        </h3>
        {shortDescription && (
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-sea-900/70">{shortDescription}</p>
        )}

        <dl className="mt-4 space-y-2 border-t border-sand-200 pt-4 text-sm text-sea-900/75">
          {duration && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-sea-500" aria-hidden="true" />
              <dt className="sr-only">{t('duration')}</dt>
              <dd>{duration}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 shrink-0 text-sea-500" aria-hidden="true" />
            <dt className="sr-only">{t('nextDate')}</dt>
            <dd>{next ? formatDateRange(next.start_date, next.end_date, locale) : t('noDates')}</dd>
          </div>
          {next && (
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-sea-500" aria-hidden="true" />
              <dt className="sr-only">{t('spotsRemainingLabel')}</dt>
              <dd className={next.spots_remaining > 0 && next.spots_remaining <= 4 ? 'font-semibold text-sun-600' : ''}>
                {next.spots_remaining > 0 ? t('spotsLeft', { count: next.spots_remaining }) : t('soldOut')}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-5 flex items-end justify-between gap-3 border-t border-sand-200 pt-4">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-sea-900/50">{t('perPerson')}</p>
            <p className="font-display text-lg font-bold text-sea-900">
              {formatPrice(price, experience.currency, locale)}
            </p>
          </div>
          {soldOut ? (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-sea-700 px-4 text-sm font-semibold text-sea-800 transition-colors hover:bg-sea-700 hover:text-white"
            >
              {t('joinWaitlist')}
            </a>
          ) : (
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-sea-700 px-4 text-sm font-semibold text-white transition-colors group-hover:bg-sea-800">
              {t('viewExperience')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            </span>
          )}
        </div>
      </div>
    </article>
  )
}
