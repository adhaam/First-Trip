'use client'

import { useLocale, useTranslations } from 'next-intl'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { discountedExperiencePrice } from '@/lib/experience-pricing'
import { formatAmount } from '@/lib/format'
import type { Experience } from '@/lib/types'

/**
 * Signature's face of the shared `<EditorialCard>` — the same card shape
 * Trips/Stays/Merch use (BRIEF.md "Hierarchy over uniformity"), with the
 * badge/category/price detail a Signature Experience specifically needs.
 * `meta` stays plain text (the slot's convention elsewhere — see
 * src/app/[locale]/explore/page.tsx) rather than nesting a stacked
 * `<PriceTag>` inside EditorialCard's single-line meta row.
 */
export function SignatureExperienceCard({
  experience,
  size = 'md',
  priority = false,
  className,
}: {
  experience: Experience
  size?: 'lg' | 'md' | 'sm'
  priority?: boolean
  className?: string
}) {
  const t = useTranslations('signatureV2')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const name = ar ? experience.title_ar : experience.title_en
  const badge = ar ? experience.badge_ar : experience.badge_en
  const category = ar ? experience.category_info?.label_ar : experience.category_info?.label_en
  const cover = experience.hero_image || experience.gallery?.[0] || '/media/heroposter.webp'
  const price = discountedExperiencePrice(experience)

  return (
    <EditorialCard
      href={`/signature/${experience.slug}`}
      image={cover}
      title={name}
      kicker={category}
      badge={badge}
      size={size}
      priority={priority}
      className={className}
      meta={
        price > 0 ? (
          <span className="font-semibold">
            {experience.starting_from_price && `${t('startingFrom')} `}
            <span className="tabular-nums">{formatAmount(price, locale)}</span> {common('egp')}
          </span>
        ) : (
          <span>{t('requestCta')}</span>
        )
      }
    />
  )
}
