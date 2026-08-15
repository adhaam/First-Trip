'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { WaveDivider } from '@/components/brand/Section'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Shield, FileText, RefreshCcw, Lock } from 'lucide-react'

const tabs = [
  { id: 'booking', icon: FileText, label_ar: 'حجز', label_en: 'Booking' },
  { id: 'cancellation', icon: RefreshCcw, label_ar: 'إلغاء', label_en: 'Cancellation' },
  { id: 'terms', icon: FileText, label_ar: 'شروط', label_en: 'Terms' },
  { id: 'privacy', icon: Lock, label_ar: 'خصوصية', label_en: 'Privacy' },
] as const

export function PolicyClient() {
  const t = useTranslations('policy')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [active, setActive] = useState<string>('booking')

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-24 grain">
        <div className="absolute inset-0 opacity-15">
          <Image src={PLACEHOLDER_IMAGES.desert2} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {ar ? 'السياسات' : 'Policies'}
          </span>
          <Shield className="mx-auto mb-4 h-10 w-10 opacity-80" />
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">
            {ar
              ? 'سياساتنا واضحة وشفافة — اقرأها قبل الحجز'
              : 'Our policies are clear & transparent — please read before booking'}
          </p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <section className="section-padding bg-sand-50">
        <div className="container-main max-w-4xl">
          <Reveal>
            <article className="overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
              {/* Tab bar */}
              <div className="no-scrollbar flex gap-0 overflow-x-auto border-b border-sand-200">
                {tabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActive(tab.id)}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-1.5 px-4 py-3.5 text-xs font-medium whitespace-nowrap transition-colors md:text-sm',
                        active === tab.id
                          ? 'border-b-2 border-sea-600 text-sea-900'
                          : 'text-sea-900/50 hover:text-sea-900/80',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{t(tab.id as 'booking')}</span>
                      <span className="sm:hidden">{ar ? tab.label_ar : tab.label_en}</span>
                    </button>
                  )
                })}
              </div>

              {/* Tab content */}
              <div className="p-6 md:p-10">
                {active === 'booking' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl font-semibold text-sea-900">{t('booking')}</h3>
                    <p className="leading-relaxed text-sea-900/65">{t('bookingText')}</p>
                  </div>
                )}

                {active === 'cancellation' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl font-semibold text-sea-900">{t('cancellation')}</h3>
                    <p className="leading-relaxed text-sea-900/65">{t('cancellationText')}</p>
                    <div className="mt-4 rounded-xl border border-sun-200 bg-sun-50 p-4">
                      <ul className="space-y-2 text-sm text-sea-900/70">
                        <li className="flex gap-2"><span className="text-emerald-600">✓</span> {ar ? '7+ أيام قبل الرحلة: استرداد 100%' : '7+ days before: 100% refund'}</li>
                        <li className="flex gap-2"><span className="text-sun-500">✓</span> {ar ? '3-6 أيام: استرداد 50%' : '3-6 days before: 50% refund'}</li>
                        <li className="flex gap-2"><span className="text-red-500">✗</span> {ar ? 'أقل من 48 ساعة: لا استرداد' : 'Less than 48h: No refund'}</li>
                      </ul>
                    </div>
                  </div>
                )}

                {active === 'terms' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl font-semibold text-sea-900">{t('terms')}</h3>
                    <div className="space-y-3 leading-relaxed text-sea-900/65">
                      <p>
                        {ar
                          ? 'بالحجز معنا، يوافق العميل على جميع الشروط والأحكام التالية:'
                          : 'By booking with us, the customer agrees to all following terms & conditions:'}
                      </p>
                      <ol className="list-decimal space-y-2 ps-6">
                        <li>{ar ? 'الحجز مؤكد فقط بعد دفع العربون (50%)' : 'Your booking will be confirmed only after paying the deposit (50%)'}</li>
                        <li>{ar ? 'الأسعار قابلة للتغيير حسب الموسم والطلب' : 'Prices are subject to change based on season & demand'}</li>
                        <li>{ar ? 'الشركة غير مسؤولة عن الأغراض الشخصية المفقودة' : 'Company not responsible for lost personal belongings'}</li>
                        <li>{ar ? 'العميل مسؤول عن سلوكه الشخصي خلال الرحلة' : 'Customer is responsible for personal conduct during the trip'}</li>
                      </ol>
                    </div>
                  </div>
                )}

                {active === 'privacy' && (
                  <div className="space-y-4">
                    <h3 className="font-display text-xl font-semibold text-sea-900">{t('privacy')}</h3>
                    <p className="leading-relaxed text-sea-900/65">
                      {ar
                        ? 'نحترم خصوصيتك. كل البيانات اللي بنجمعها (الاسم، الموبايل، الإيميل) بتُستخدم فقط لغرض تأكيد الحجز والتواصل معك. مش بنشارك بياناتك مع أي طرف ثالث أبداً.'
                        : 'We respect your privacy. All data we collect (name, phone, email) is used only for booking confirmation and communication. We never share your data with any third party.'}
                    </p>
                  </div>
                )}
              </div>
            </article>
          </Reveal>
        </div>
      </section>
    </div>
  )
}
