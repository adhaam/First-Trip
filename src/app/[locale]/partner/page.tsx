'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { WaveDivider } from '@/components/brand/Section'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { Handshake, Users, TrendingUp, Megaphone, CheckCircle2, Send } from 'lucide-react'

const benefits = [
  { icon: Users, key: 'benefit1' },
  { icon: TrendingUp, key: 'benefit2' },
  { icon: Megaphone, key: 'benefit3' },
  { icon: CheckCircle2, key: 'benefit4' },
] as const

export default function PartnerPage() {
  const t = useTranslations('partner')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [submitted, setSubmitted] = useState(false)

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src={PLACEHOLDER_IMAGES.desert1} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {ar ? 'شراكات' : 'Partnerships'}
          </span>
          <Handshake className="mx-auto mb-4 h-10 w-10 opacity-80" />
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      {/* Benefits */}
      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <Reveal>
            <h2 className="mb-12 text-center font-display text-2xl font-bold text-sea-900 md:text-3xl">
              {t('benefits')}
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((b, i) => (
              <Reveal key={i} delay={i * 80}>
                <article className="border-[1.5px] border-sand-300 bg-white p-6 text-center pin-card transition-shadow hover:shadow-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-sun-400 text-white">
                    <b.icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm leading-relaxed text-sea-900/70">{t(b.key)}</p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="section-padding bg-white">
        <div className="container-main max-w-2xl">
          <Reveal>
            <article className="border-[1.5px] border-sand-300 bg-sand-50 p-8 pin-card">
              <h2 className="mb-6 text-center font-display text-2xl font-bold text-sea-900">
                {t('contactForm')}
              </h2>

              {submitted ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-lg text-sea-900/70">{t('success')}</p>
                </div>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="name" className="mb-1 block text-sm font-medium text-sea-900/80">{t('name')}</label>
                    <input id="name" required className="w-full rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm text-sea-900 outline-none transition-colors focus:border-sea-600 focus:ring-1 focus:ring-sea-600" />
                  </div>
                  <div>
                    <label htmlFor="business" className="mb-1 block text-sm font-medium text-sea-900/80">{t('business')}</label>
                    <input id="business" required className="w-full rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm text-sea-900 outline-none transition-colors focus:border-sea-600 focus:ring-1 focus:ring-sea-600" />
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-1 block text-sm font-medium text-sea-900/80">{t('phone')}</label>
                    <input id="phone" type="tel" required dir="ltr" className="w-full rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm text-sea-900 outline-none transition-colors focus:border-sea-600 focus:ring-1 focus:ring-sea-600" />
                  </div>
                  <div>
                    <label htmlFor="message" className="mb-1 block text-sm font-medium text-sea-900/80">{t('message')}</label>
                    <textarea id="message" rows={4} className="w-full rounded-lg border border-sand-300 bg-white px-4 py-2.5 text-sm text-sea-900 outline-none transition-colors focus:border-sea-600 focus:ring-1 focus:ring-sea-600" />
                  </div>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-sea-900 px-6 py-3 text-sm font-semibold text-sand-50 transition-colors hover:bg-sea-800"
                  >
                    <Send className="h-4 w-4" />
                    {t('send')}
                  </button>
                </form>
              )}
            </article>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
