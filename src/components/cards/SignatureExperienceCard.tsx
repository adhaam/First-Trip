'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { discountedExperiencePrice } from '@/lib/experience-pricing'
import type { Experience } from '@/lib/types'

export function SignatureExperienceCard({ experience, className }: { experience: Experience; className?: string }) {
  const t = useTranslations('signature')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const name = ar ? experience.title_ar : experience.title_en
  const badge = ar ? experience.badge_ar : experience.badge_en
  const category = ar ? experience.category_info?.label_ar : experience.category_info?.label_en
  const cover = experience.hero_image || experience.gallery?.[0] || '/media/heroposter.png'
  const price = discountedExperiencePrice(experience)

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link href={`/signature/${experience.slug}`} aria-label={name} className="block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3">
        <article className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sea-900/15 bg-card pin-card">
          <div className="relative aspect-[3/2] overflow-hidden">
            <Image
              src={cover}
              alt={name}
              fill
              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/70 to-transparent" />
            {badge && (
              <span className="absolute start-3 top-3 rounded-full bg-weemap-charcoal px-3 py-1 text-[0.7rem] font-semibold text-weemap-orange shadow">
                {badge}
              </span>
            )}
            {category && (
              <span className="absolute end-3 top-3 rounded-full bg-sand-50/95 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
                {category}
              </span>
            )}
            <div className="absolute inset-x-4 bottom-3">
              <h3 className="font-display text-lg font-bold leading-snug text-white drop-shadow">{name}</h3>
            </div>
          </div>

          <div className="flex flex-1 flex-col p-5">
            {experience.short_description_ar && (
              <p className="line-clamp-2 text-sm leading-relaxed text-sea-900/60">
                {ar ? experience.short_description_ar : experience.short_description_en}
              </p>
            )}

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <div className="font-display text-lg font-bold text-sea-900">
                {experience.starting_from_price && <span className="me-1 text-sm font-semibold text-sea-900/60">{t('startingFrom')}</span>}
                {price.toLocaleString()} <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-md border border-weemap-orange px-4 py-2 text-xs font-semibold text-weemap-orange transition-colors group-hover:bg-weemap-orange group-hover:text-white">
                {t('requestCta')}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
