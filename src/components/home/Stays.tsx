'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { PriceTag } from '@/components/brand/PriceTag'
import { Reveal } from '@/components/motion/Reveal'
import { stayFromPricePerPersonPerNight, type StaysLineup } from '@/lib/home-sections'

/**
 * Editorial stays layout: one hero-scale pick beside 2–3 smaller ones — never
 * a grid of identical cards. The "from" price is per person, per night,
 * computed from the accommodation's own room prices for display only; the
 * real total is always priced server-side when a stay is actually booked.
 */
export function Stays({ lineup }: { lineup: StaysLineup }) {
  const t = useTranslations('homeV2.stays')
  const locale = useLocale()
  const ar = locale === 'ar'

  if (!lineup.hero) return null

  return (
    <Section tone="paper">
      <SectionHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <ButtonLink href="/book-dahab" variant="outline-ink" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      {/* items-start: EditorialCard sizes itself to its image's aspect ratio,
          not to the tallest grid cell. Without this, the default grid
          stretch makes the hero cell match the stacked secondaries column's
          (taller) height, leaving blank card background below the hero
          image instead of the image filling the card. */}
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        <Reveal className="min-w-0 lg:col-span-7">
          <EditorialCard
            href={`/book-dahab/${lineup.hero.id}`}
            image={lineup.hero.image_url || lineup.hero.images?.[0] || '/media/heroposter.webp'}
            title={ar ? lineup.hero.name_ar : lineup.hero.name_en}
            size="lg"
            meta={
              <PriceTag
                amount={stayFromPricePerPersonPerNight(lineup.hero)}
                from
                unit="personNight"
                size="sm"
                tone="light"
              />
            }
          />
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          {lineup.secondaries.map((acc, i) => (
            <Reveal key={acc.id} delay={(i + 1) * 80}>
              <EditorialCard
                href={`/book-dahab/${acc.id}`}
                image={acc.image_url || acc.images?.[0] || '/media/heroposter.webp'}
                title={ar ? acc.name_ar : acc.name_en}
                size="sm"
                meta={<PriceTag amount={stayFromPricePerPersonPerNight(acc)} from unit="personNight" size="sm" tone="light" />}
              />
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  )
}
