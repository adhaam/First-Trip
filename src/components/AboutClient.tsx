'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Compass, Layers3, MapPinned, Route } from 'lucide-react'
import { WaveDivider } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { TrustSection } from '@/components/TrustSection'

export function AboutClient() {
  const t = useTranslations('about')
  const pillars = [
    { icon: Compass, title: t('whyTitle'), text: t('whyText') },
    { icon: Layers3, title: t('platformTitle'), text: t('platformText') },
    { icon: MapPinned, title: t('localTitle'), text: t('localText') },
    { icon: Route, title: t('connectionTitle'), text: t('connectionText') },
  ]

  return (
    <div className="bg-sand-50">
      <section className="relative isolate min-h-[60svh] overflow-hidden bg-sea-900 py-24 text-white md:py-32">
        <Image
          src="/media/heroposter.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-sea-900 via-sea-900/65 to-black/30" />
        <div className="container-main relative flex min-h-[36svh] items-end">
          <Reveal always>
            <p className="eyebrow text-sun-300">{t('eyebrow')}</p>
            <h1 className="mt-5 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl md:text-7xl">
              {t('title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
              {t('intro')}
            </p>
          </Reveal>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <div>
        <section className="section-padding" aria-label={t('title')}>
          <div className="container-main">
            <div className="grid gap-x-12 gap-y-10 md:grid-cols-2">
              {pillars.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 70}>
                  <article className="border-t border-sand-300 pt-6">
                    <Icon className="h-7 w-7 text-sun-700" aria-hidden="true" />
                    <h2 className="mt-5 font-display text-2xl font-bold text-sea-900">{title}</h2>
                    <p className="mt-3 max-w-xl text-base leading-8 text-ink-muted">{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>

            <Reveal>
              <blockquote className="mt-16 border-s-4 border-sun-600 py-3 ps-7 font-display text-3xl font-extrabold leading-tight text-sea-900 sm:text-4xl md:text-5xl">
                {t('tagline')}
              </blockquote>
            </Reveal>
          </div>
        </section>

        <TrustSection />
      </div>
    </div>
  )
}
