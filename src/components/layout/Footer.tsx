'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Logo } from '@/components/brand/Logo'
import { WaveDivider } from '@/components/brand/Section'
import { NAV_ITEMS, WHATSAPP_NUMBER, PHONE_NUMBER, EMAIL } from '@/lib/constants'
import { MapPin, Phone, Mail, ArrowUpRight } from 'lucide-react'
import type { SiteSettings } from '@/lib/types'

export function Footer({ settings }: { settings?: SiteSettings | null }) {
  const t = useTranslations('footer')
  const locale = useLocale()
  const ar = locale === 'ar'

  const whatsapp = settings?.whatsapp_number || WHATSAPP_NUMBER
  const phone = settings?.phone_number || PHONE_NUMBER
  const email = settings?.email || EMAIL
  const facebook = settings?.facebook_url || 'https://www.facebook.com/FirstTrip.eg/'
  const instagram = settings?.instagram_url || 'https://www.instagram.com/'

  return (
    <footer className="relative mt-auto bg-sea-900 text-sand-100">
      {/* torn-paper transition from the page's sand into the deep sea footer */}
      <WaveDivider className="absolute -top-px inset-x-0 -translate-y-full text-sea-900" flip />

      <div className="depth-bg">
        <div className="container-main py-16 md:py-20">
          <div className="grid grid-cols-2 gap-x-8 gap-y-12 md:grid-cols-4 lg:gap-12">
            {/* Brand */}
            <div className="col-span-2 lg:col-span-1">
              <Logo size="lg" tone="light" />
              <p className="mt-5 max-w-xs text-sm leading-relaxed text-sand-100/65">
                {ar
                  ? 'بننظم رحلات لدهب من 2017. انتقالات، إقامة، ورحلات داخلية — من غير ما تفكر في حاجة.'
                  : 'Organising trips to Dahab since 2017. Transfers, stays and day trips — without you having to think about any of it.'}
              </p>

              <div className="mt-6 flex gap-2">
                <SocialLink href={facebook} label="Facebook">
                  <path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.75 8.44-4.91 8.44-9.93z" />
                </SocialLink>
                <SocialLink href={instagram} label="Instagram" stroke>
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                </SocialLink>
              </div>
            </div>

            {/* Quick links */}
            <div>
              <h3 className="mb-5 font-display text-xs font-bold uppercase tracking-[0.2em] text-sun-300">
                {t('quickLinks')}
              </h3>
              <ul className="space-y-2.5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-sm text-sand-100/70 transition-colors hover:text-white"
                    >
                      {item[ar ? 'label_ar' : 'label_en']}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h3 className="mb-5 font-display text-xs font-bold uppercase tracking-[0.2em] text-sun-300">
                {t('contact')}
              </h3>
              <ul className="space-y-3.5">
                <li className="flex items-start gap-2.5 text-sm text-sand-100/70">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sun-300" />
                  <span>{t('dahab')}</span>
                </li>
                <li>
                  <a
                    href={`tel:${phone}`}
                    className="flex items-center gap-2.5 text-sm text-sand-100/70 transition-colors hover:text-white"
                  >
                    <Phone className="h-4 w-4 shrink-0 text-sun-300" />
                    <span dir="ltr">{phone}</span>
                  </a>
                </li>
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="flex items-center gap-2.5 text-sm text-sand-100/70 transition-colors hover:text-white"
                  >
                    <Mail className="h-4 w-4 shrink-0 text-sun-300" />
                    <span dir="ltr" className="break-all">{email}</span>
                  </a>
                </li>
              </ul>
            </div>

            {/* WhatsApp */}
            <div className="col-span-2 md:col-span-1">
              <h3 className="mb-5 font-display text-xs font-bold uppercase tracking-[0.2em] text-sun-300">
                {t('followUs')}
              </h3>
              <p className="mb-5 text-sm leading-relaxed text-sand-100/70">
                {ar
                  ? 'عندك سؤال؟ إحنا موجودين على واتساب طول اليوم.'
                  : 'Got a question? We\'re on WhatsApp all day.'}
              </p>
              <a
                href={`https://wa.me/${whatsapp.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-sun-400 px-6 text-sm font-semibold text-white transition-colors hover:bg-sun-500"
              >
                WhatsApp
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="container-main flex flex-col items-center justify-between gap-3 py-6 sm:flex-row">
            <p className="text-xs text-sand-100/50">{t('rights')}</p>
            <div className="flex gap-5 text-xs text-sand-100/50">
              <Link href="/policy" className="transition-colors hover:text-white">
                {ar ? 'سياسة الخصوصية' : 'Privacy Policy'}
              </Link>
              <Link href="/policy" className="transition-colors hover:text-white">
                {ar ? 'الشروط والأحكام' : 'Terms & Conditions'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialLink({
  href,
  label,
  children,
  stroke = false,
}: {
  href: string
  label: string
  children: React.ReactNode
  stroke?: boolean
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-sand-100/70 transition-all hover:-translate-y-0.5 hover:border-sun-300/60 hover:text-sun-300"
    >
      <svg
        className="h-[18px] w-[18px]"
        viewBox="0 0 24 24"
        fill={stroke ? 'none' : 'currentColor'}
        stroke={stroke ? 'currentColor' : undefined}
        strokeWidth={stroke ? 2 : undefined}
      >
        {children}
      </svg>
    </a>
  )
}
