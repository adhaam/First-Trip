'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { Building2, Bus, Compass, Handshake, Mail, MessageCircle } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { PartnerInquiryForm } from '@/components/PartnerInquiryForm'
import { WHATSAPP_NUMBER, EMAIL } from '@/lib/constants'
import { trackConversion } from '@/lib/conversion'
import type { SiteSettings } from '@/lib/types'

export function PartnerClient({ settings }: { settings: SiteSettings | null }) {
  const t = useTranslations('partner')
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const email = settings?.email || EMAIL
  const groups = [
    { icon: Building2, title: t('hotels'), text: t('hotelsText') },
    { icon: Compass, title: t('experiences'), text: t('experiencesText') },
    { icon: Bus, title: t('transport'), text: t('transportText') },
  ]
  const steps = [
    { title: t('step1Title'), text: t('step1Text') },
    { title: t('step2Title'), text: t('step2Text') },
    { title: t('step3Title'), text: t('step3Text') },
    { title: t('step4Title'), text: t('step4Text') },
  ]

  return (
    <div className="bg-sand-50">
      <section className="relative isolate min-h-[60svh] overflow-hidden bg-sea-900 py-24 text-white md:py-32">
        <Image src="/media/heroposter.webp" alt="" fill priority sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/25 rtl:bg-gradient-to-l" />
        <div className="container-main flex min-h-[34svh] items-end">
          <Reveal always>
            <Handshake className="h-9 w-9 text-sun-300" aria-hidden="true" />
            <p className="eyebrow mt-6 text-sun-300">{t('eyebrow')}</p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl md:text-7xl">
              {t('title')}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/78">{t('subtitle')}</p>
          </Reveal>
        </div>
      </section>

      <div>
        <section className="section-padding">
          <div className="container-main">
            <Reveal>
              <h2 className="font-display text-3xl font-bold text-sea-900 md:text-4xl">{t('typesTitle')}</h2>
            </Reveal>
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {groups.map(({ icon: Icon, title, text }, index) => (
                <Reveal key={title} delay={index * 70}>
                  <article className="h-full border-t-2 border-sun-600 bg-card p-7">
                    <Icon className="h-7 w-7 text-sun-700" aria-hidden="true" />
                    <h3 className="mt-5 font-display text-xl font-bold text-sea-900">{title}</h3>
                    <p className="mt-3 text-sm leading-7 text-ink-muted">{text}</p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-sand-100 py-14 md:py-20">
          <div className="container-main grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <Reveal>
              <div>
                <h2 className="font-display text-3xl font-bold text-sea-900">{t('whyTitle')}</h2>
                <p className="mt-5 text-base leading-8 text-ink-muted">{t('whyText')}</p>
              </div>
            </Reveal>
            <div>
              <Reveal>
                <h2 className="font-display text-3xl font-bold text-sea-900">{t('processTitle')}</h2>
              </Reveal>
              <ol className="mt-7 divide-y divide-sand-300 border-y border-sand-300">
                {steps.map((step, index) => (
                  <li key={step.title} className="grid gap-3 py-6 sm:grid-cols-[3rem_1fr]">
                    <span className="font-display text-xl font-extrabold text-sun-700" aria-hidden="true">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div>
                      <h3 className="font-display text-lg font-bold text-sea-900">{step.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-ink-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="container-main py-14 md:py-20">
          <div className="grid gap-8 bg-sea-900 p-7 text-white sm:p-9 md:grid-cols-[1fr_auto] md:items-center md:p-12">
            <div>
              <h2 className="font-display text-3xl font-bold">{t('contactTitle')}</h2>
              <p className="mt-3 max-w-xl leading-7 text-white/68">{t('contactText')}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackConversion('whatsapp_click', { source: 'partner_page', content_type: 'partner' }, { once: false })}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-sun-500 px-6 font-semibold hover:bg-sun-600"
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />{t('whatsapp')}
              </a>
              <a href={`mailto:${email}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 px-6 font-semibold hover:bg-white/10">
                <Mail className="h-4 w-4" aria-hidden="true" />{t('email')}
              </a>
            </div>
          </div>
        </section>

        <section className="container-main pb-14 md:pb-20">
          <Reveal>
            <div className="mx-auto max-w-2xl border-t-2 border-sun-600 bg-card p-7 sm:p-9">
              <h2 className="font-display text-3xl font-bold text-sea-900">{t('formTitle')}</h2>
              <p className="mt-3 text-sm leading-7 text-ink-muted">{t('formSubtitle')}</p>
              <div className="mt-7">
                <PartnerInquiryForm />
              </div>
            </div>
          </Reveal>
        </section>
      </div>
    </div>
  )
}
