'use client'

import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { ButtonLink } from '@/components/ButtonLink'
import { Reveal } from '@/components/motion/Reveal'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import type { SiteSettings } from '@/lib/types'

export function FinalCta({ settings }: { settings: SiteSettings | null }) {
  const t = useTranslations('homeV2.finalCta')
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')

  return (
    <section className="relative overflow-hidden bg-sun-400 py-20 text-on-accent md:py-28 grain">
      <div aria-hidden className="absolute -end-24 -top-24 h-80 w-80 rounded-full border-[3rem] border-on-accent/10" />
      <div aria-hidden className="absolute -bottom-32 -start-16 h-72 w-72 rounded-full border-[2.5rem] border-on-accent/10" />

      <div className="container-main relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            {t('title')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-on-accent/85 md:text-lg">{t('subtitle')}</p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/plan" size="lg" variant="ink" className="h-13 px-8">
              {t('primaryCta')}
            </ButtonLink>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-on-accent/65 px-8 text-base font-medium text-on-accent transition-all hover:bg-on-accent/10"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              {t('whatsappCta')}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
