'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { Reveal } from '@/components/motion/Reveal'
import type { CategoryTile } from '@/lib/home-sections'
import { NEUTRAL_MEDIA } from '@/lib/media'

/**
 * The Sinai trip taxonomy, rendered as tiles — never a text list. Categories
 * and their labels come straight from `deriveTripCategoryChips` (the DB
 * taxonomy), so this section can't drift from what `/sinai-trips` itself
 * filters on; each tile links to `?category=<chip id>`, the same param the
 * trips page reads.
 */
export function ExploreCategories({ tiles }: { tiles: CategoryTile[] }) {
  const t = useTranslations('homeV2.explore')
  const locale = useLocale()
  const ar = locale === 'ar'

  if (tiles.length === 0) return null

  return (
    <Section tone="sea">
      <SectionHeading
        tone="light"
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <ButtonLink href="/sinai-trips" variant="outline-light" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map(({ chip, image }, i) => (
          <Reveal key={chip.id} delay={i * 60}>
            <EditorialCard
              href={`/sinai-trips?category=${encodeURIComponent(chip.id)}`}
              image={image || NEUTRAL_MEDIA}
              title={ar ? chip.name_ar : chip.name_en}
              size="sm"
            />
          </Reveal>
        ))}
      </div>

      <p className="mt-8 max-w-xl text-sm leading-relaxed text-sea-100/80">{t('truthLine')}</p>
    </Section>
  )
}
