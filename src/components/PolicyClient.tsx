'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import {
  BedDouble,
  Bus,
  CalendarClock,
  CloudSun,
  CreditCard,
  FileCheck2,
  HelpCircle,
  Lock,
  Map,
  RefreshCcw,
  Shield,
  UserX,
} from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import type { SiteSettings } from '@/lib/types'

export function PolicyClient({ settings }: { settings: SiteSettings | null }) {
  const locale = useLocale()
  const t = useTranslations('policy')
  const ar = locale === 'ar'
  const refundPolicy = ar ? settings?.refund_policy_ar : settings?.refund_policy_en
  const privacyPolicy = ar ? settings?.privacy_policy_ar : settings?.privacy_policy_en
  const additionalTerms = ar ? settings?.terms_ar : settings?.terms_en
  const sections = [
    { icon: FileCheck2, title: t('booking'), text: t('bookingText') },
    { icon: RefreshCcw, title: t('cancellation'), text: t('cancellationText') },
    { icon: CreditCard, title: t('refunds'), text: refundPolicy?.trim() || t('refundsText') },
    { icon: CalendarClock, title: t('dateChanges'), text: t('dateChangesText') },
    { icon: UserX, title: t('noShow'), text: t('noShowText') },
    { icon: BedDouble, title: t('accommodation'), text: t('accommodationText') },
    { icon: Map, title: t('trips'), text: t('tripsText') },
    { icon: Bus, title: t('transport'), text: t('transportText') },
    { icon: CloudSun, title: t('operations'), text: t('operationsText') },
    { icon: CreditCard, title: t('payments'), text: t('paymentsText') },
    { icon: Lock, title: t('privacy'), text: privacyPolicy?.trim() || t('privacyText') },
    { icon: HelpCircle, title: t('contact'), text: t('contactText') },
  ]

  return (
    <div className="bg-sand-50">
      <section className="relative isolate overflow-hidden bg-sea-900 py-24 text-white md:py-32">
        <Image src="/media/heroposter.png" alt="" fill priority sizes="100vw" className="-z-20 object-cover opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 to-black/50 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <Reveal>
            <Shield className="h-9 w-9 text-sun-300" aria-hidden="true" />
            <p className="eyebrow mt-6 text-sun-300">{t('eyebrow')}</p>
            <h1 className="mt-4 max-w-4xl font-display text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">
              {t('title')}
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/75">{t('subtitle')}</p>
          </Reveal>
        </div>
      </section>

      <main className="container-main py-12 md:py-20">
        <div className="mx-auto max-w-5xl divide-y divide-sand-300 border-y border-sand-300">
          {sections.map(({ icon: Icon, title, text }) => (
            <section key={title} className="grid gap-4 py-8 md:grid-cols-[15rem_1fr] md:gap-10 md:py-10">
              <h2 className="flex items-start gap-3 font-display text-lg font-bold text-sea-900">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sun-500" aria-hidden="true" />
                {title}
              </h2>
              <p className="whitespace-pre-line text-base leading-8 text-sea-900/72">{text}</p>
            </section>
          ))}

          {additionalTerms?.trim() && (
            <section className="grid gap-4 py-8 md:grid-cols-[15rem_1fr] md:gap-10 md:py-10">
              <h2 className="flex items-start gap-3 font-display text-lg font-bold text-sea-900">
                <FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-sun-500" aria-hidden="true" />
                {t('additionalTerms')}
              </h2>
              <p className="whitespace-pre-line text-base leading-8 text-sea-900/72">{additionalTerms}</p>
            </section>
          )}
        </div>
      </main>
    </div>
  )
}
