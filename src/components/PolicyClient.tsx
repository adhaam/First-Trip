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

      {/* Footer */}
      <footer className="border-t border-sand-300 bg-white">
        <div className="container-main py-12 md:py-16">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 md:grid-cols-3">
              {/* About */}
              <div>
                <h3 className="font-display text-lg font-bold text-sea-900 mb-4">
                  {ar ? 'عن ويمابس' : 'About WEEMAP'}
                </h3>
                <p className="text-sm text-sea-900/70 leading-relaxed">
                  {ar
                    ? 'نساعد في التخطيط للرحلات والإقامة في سيناء بطريقة احترافية وسهلة.'
                    : 'We help plan trips and accommodations in Sinai professionally and easily.'}
                </p>
              </div>

              {/* Quick Links */}
              <div>
                <h3 className="font-display text-lg font-bold text-sea-900 mb-4">
                  {ar ? 'روابط سريعة' : 'Quick Links'}
                </h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="/" className="text-sea-600 hover:text-sea-900 transition-colors">{ar ? 'الرئيسية' : 'Home'}</a></li>
                  <li><a href={ar ? '/ar/book-dahab' : '/en/book-dahab'} className="text-sea-600 hover:text-sea-900 transition-colors">{ar ? 'حجز بدايتك' : 'Book Now'}</a></li>
                  <li><a href={ar ? '/ar/sinai-trips' : '/en/sinai-trips'} className="text-sea-600 hover:text-sea-900 transition-colors">{ar ? 'الرحلات' : 'Trips'}</a></li>
                  <li><a href={ar ? '/ar/community' : '/en/community'} className="text-sea-600 hover:text-sea-900 transition-colors">{ar ? 'المجتمع' : 'Community'}</a></li>
                </ul>
              </div>

              {/* Social & Attribution */}
              <div>
                <h3 className="font-display text-lg font-bold text-sea-900 mb-4">
                  {ar ? 'تابعنا' : 'Follow Us'}
                </h3>
                <div className="space-y-3">
                  <p className="text-sm text-sea-900/70">
                    {ar ? 'تابعنا على الإنستجرام للآخبار والصور اليومية.' : 'Follow us on Instagram for news and daily photos.'}
                  </p>
                  <a
                    href="https://www.instagram.com/adham_abduullaah/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex px-4 py-2 bg-sun-500 hover:bg-sun-600 text-white rounded-lg transition-colors font-medium text-sm"
                  >
                    {ar ? 'Instagram' : 'Instagram'} ↗
                  </a>
                </div>
              </div>
            </div>

            {/* Copyright & Development */}
            <div className="mt-12 pt-8 border-t border-sand-300">
              <div className="text-center text-sm text-sea-900/60 space-y-2">
                <p>
                  {ar ? '© 2026 ويمابس سيناء. جميع الحقوق محفوظة.' : '© 2026 WEEMAP SINAI. All rights reserved.'}
                </p>
                <p>
                  {ar ? 'هذا الموقع تم تطويره بواسطة ' : 'This website was developed by '}
                  <a
                    href="https://www.instagram.com/adham_abduullaah/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sun-600 hover:text-sun-700 underline transition-colors"
                  >
                    {ar ? 'أدهم عبد الله' : 'Adham Abduullaah'}
                  </a>
                  {ar ? ' — هل تريد موقع مشابه؟ ' : ' — Want a similar website? '}
                  <a
                    href="https://www.instagram.com/adham_abduullaah/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sun-600 hover:text-sun-700 underline transition-colors"
                  >
                    {ar ? 'تواصل معنا' : 'Get in touch'}
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
