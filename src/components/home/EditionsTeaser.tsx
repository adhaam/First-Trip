'use client'

import { useLocale, useTranslations } from 'next-intl'
import { SafeImage as Image } from '@/components/SafeImage'
import { ButtonLink } from '@/components/ButtonLink'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { Reveal } from '@/components/motion/Reveal'
import { NEUTRAL_MEDIA } from '@/lib/media'
import type { PublicEdition } from '@/lib/editions'

/**
 * Replaces SignatureMoment as the public homepage entry point into WEEMAP
 * Editions. `featuredEdition` is the soonest dated, bookable Edition (see
 * selectFeaturedEdition, src/lib/home-sections.ts) or null. This is
 * deliberately a single teaser, never the six-concept grid — that grid only
 * belongs on /editions itself.
 */
export function EditionsTeaser({ featuredEdition }: { featuredEdition: PublicEdition | null }) {
  const t = useTranslations('editions')
  const ar = useLocale() === 'ar'
  const title = featuredEdition ? (ar ? featuredEdition.title_ar : featuredEdition.title_en) : null
  const short = featuredEdition
    ? (ar ? featuredEdition.short_description_ar : featuredEdition.short_description_en)
    : null
  const image = featuredEdition?.hero_image_url || NEUTRAL_MEDIA

  return (
    <section className="relative isolate min-h-[32rem] overflow-hidden bg-sea-900 text-white md:min-h-[38rem]">
      <Image src={image} alt="" fill sizes="100vw" className="-z-20 object-cover object-center" />
      <div
        className={[
          'absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-black/10',
          'rtl:bg-gradient-to-l',
        ].join(' ')}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
      <div className="container-main flex min-h-[32rem] items-end py-14 md:min-h-[38rem] md:items-center md:py-24">
        <Reveal className="max-w-2xl">
          <Eyebrow tone="light">{t('landing.eyebrow')}</Eyebrow>
          <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl md:text-5xl">
            {featuredEdition ? t('homeTeaser.datedHeading') : t('homeTeaser.fallbackHeading')}
          </h2>
          <p className="mt-6 max-w-[36rem] text-base leading-relaxed text-white/85 sm:text-lg">
            {featuredEdition ? (short || title) : t('homeTeaser.fallbackBody')}
          </p>
          <ButtonLink
            href={featuredEdition ? `/editions/${featuredEdition.slug}` : '/editions'}
            variant="sun"
            size="lg"
            className="mt-8"
          >
            {featuredEdition ? t('card.viewEdition') : t('landing.upcomingTitle')}
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}
