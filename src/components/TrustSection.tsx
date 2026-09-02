'use client'

import { useTranslations } from 'next-intl'
import { Layers3, MapPinned, MessageCircle, Route } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'

export function TrustSection() {
  const t = useTranslations('trust')
  const items = [
    { icon: MapPinned, title: t('localTitle'), text: t('localText') },
    { icon: Layers3, title: t('togetherTitle'), text: t('togetherText') },
    { icon: Route, title: t('clearTitle'), text: t('clearText') },
    { icon: MessageCircle, title: t('humanTitle'), text: t('humanText') },
  ]

  return (
    <section className="border-y border-sand-300 bg-card py-14 md:py-18" aria-labelledby="trust-heading">
      <div className="container-main">
        <Reveal>
          <div className="max-w-2xl">
            <h2 id="trust-heading" className="font-display text-2xl font-bold text-sea-900 md:text-3xl">
              {t('title')}
            </h2>
            <p className="mt-3 leading-relaxed text-ink-muted">{t('subtitle')}</p>
          </div>
        </Reveal>

        <div className="mt-9 grid gap-x-8 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 60}>
              <article className="border-t border-sand-300 pt-5">
                <Icon className="h-6 w-6 text-sun-700" aria-hidden="true" />
                <h3 className="mt-4 font-display text-base font-bold text-sea-900">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-muted">{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
