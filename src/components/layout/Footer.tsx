'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { NAV_ITEMS, WHATSAPP_NUMBER, PHONE_NUMBER, EMAIL } from '@/lib/constants'
import { MapPin, Phone, Mail } from 'lucide-react'
import Image from 'next/image'

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container-main py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="First Trip" width={28} height={28} className="h-7 w-auto" />
              <span className="text-xl font-bold text-white">
                <span className="text-[#38BDF8]">FIRST</span>{' '}
                <span className="text-[#FB923C]">TRIP</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              {locale === 'ar'
                ? 'شركة سياحة متخصصة في تنظيم الرحلات لدهب منذ 2017'
                : 'Tourism company specializing in Dahab trips since 2017'}
            </p>
            <div className="flex gap-3">
              <a href="https://facebook.com" target="_blank" rel="noopener" className="text-gray-400 hover:text-[#0EA5E9] transition-colors" aria-label="Facebook">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.54V9.84c0-2.52 1.49-3.91 3.78-3.91 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.75 8.44-4.91 8.44-9.93z"/></svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener" className="text-gray-400 hover:text-[#F97316] transition-colors" aria-label="Instagram">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('quickLinks')}</h3>
            <ul className="space-y-2">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    {item[locale === 'ar' ? 'label_ar' as keyof typeof item : 'label_en' as keyof typeof item]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('contact')}</h3>
            <ul className="space-y-3">
              <li className="flex items-start gap-2 text-sm text-gray-400">
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#F97316]" />
                <span>{t('dahab')}</span>
              </li>
              <li>
                <a href={`tel:${PHONE_NUMBER}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Phone className="h-4 w-4 text-[#F97316]" />
                  <span dir="ltr">{PHONE_NUMBER}</span>
                </a>
              </li>
              <li>
                <a href={`mailto:${EMAIL}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
                  <Mail className="h-4 w-4 text-[#F97316]" />
                  <span dir="ltr">{EMAIL}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* WhatsApp CTA */}
          <div>
            <h3 className="text-white font-semibold mb-4">{t('followUs')}</h3>
            <p className="text-sm text-gray-400 mb-4">
              {locale === 'ar'
                ? 'عندك سؤال؟ احنا موجودين على واتساب 24/7'
                : 'Have a question? We\'re on WhatsApp 24/7'}
            </p>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center h-9 px-4 rounded-full font-medium bg-green-600 hover:bg-green-700 text-white transition-all w-full sm:w-auto"
            >
              WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800">
        <div className="container-main py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-sm text-gray-500">{t('rights')}</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/policy" className="hover:text-white transition-colors">
              {locale === 'ar' ? 'سياسة الخصوصية' : 'Privacy Policy'}
            </Link>
            <Link href="/policy" className="hover:text-white transition-colors">
              {locale === 'ar' ? 'الشروط والأحكام' : 'Terms & Conditions'}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}