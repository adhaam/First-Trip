'use client'

import { useLocale, useTranslations } from 'next-intl'
import { SafeImage as Image } from '@/components/SafeImage'
import { ButtonLink } from '@/components/ButtonLink'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { Reveal } from '@/components/motion/Reveal'

/**
 * The dark, high-touch Signature moment — deliberately the one full-bleed
 * photographic section on the page besides the hero, so it reads as a
 * distinct register rather than another content block.
 */
export function SignatureMoment() {
  const t = useTranslations('homeV2.signature')
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="relative isolate min-h-[32rem] overflow-hidden bg-sea-900 text-white md:min-h-[38rem]">
      <Image
        src="/media/heroposter.webp"
        alt={ar ? 'تجربة Signature في سيناء' : 'A Signature experience in Sinai'}
        fill
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-black/10 rtl:bg-gradient-to-l" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
      <div className="container-main flex min-h-[32rem] items-end py-14 md:min-h-[38rem] md:items-center md:py-24">
        <Reveal className="max-w-2xl">
          <Eyebrow tone="light">{t('eyebrow')}</Eyebrow>
          <h2 className="mt-5 max-w-xl font-display text-3xl font-extrabold leading-[1.1] sm:text-4xl md:text-5xl">
            {t('title')}
          </h2>
          <p className="mt-6 max-w-[36rem] text-base leading-relaxed text-white/85 sm:text-lg">{t('body')}</p>
          <ButtonLink href="/signature" variant="sun" size="lg" className="mt-8">
            {t('cta')}
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}
