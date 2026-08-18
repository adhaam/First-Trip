'use client'

import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { WaveDivider } from '@/components/brand/Section'
import { TRUST_STATS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Compass, Eye, Target } from 'lucide-react'

// WEEMAP is presented simply as the active brand — no origin/relaunch story
// (see _weemap_reference/06_business-info/WEEMAP_INFO.md: historical claims
// must be verified before publishing). These are what-we-do pillars instead.
const timeline = [
  { year: '01', title_ar: 'بنرسم الطريق', title_en: 'We Map the Way', desc_ar: 'باقات كاملة من محافظتك لدهب — انتقالات، إقامة، ورحلات داخل سيناء في حجز واحد', desc_en: 'Full packages from your governorate to Dahab — transfers, stays, and Sinai trips in one booking' },
  { year: '02', title_ar: 'إقامة واضحة', title_en: 'Clear Stay Choices', desc_ar: 'تفاصيل وصور وأسعار الغرف المتاحة في مكان واحد قبل ما تبعت طلبك', desc_en: 'Available stay details, photos, and room pricing in one place before you send a request' },
  { year: '03', title_ar: 'رحلات حقيقية', title_en: 'Real Trip Listings', desc_ar: 'بنعرض بيانات الرحلات الموجودة فعلاً من غير ما نخترع تفاصيل ناقصة', desc_en: 'We publish the trip details that actually exist, without filling gaps with made-up facts' },
  { year: '04', title_ar: 'عربي وإنجليزي', title_en: 'Arabic & English', desc_ar: 'نفس التجربة والمعلومات بشكل واضح بالعربي والإنجليزي', desc_en: 'The same coherent journey and information in Arabic and English' },
]


export function AboutClient() {
  const t = useTranslations('about')
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src="/media/heroposter.png" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {ar ? 'من نحن' : 'About Us'}
          </span>
          <Compass className="mx-auto mb-4 h-10 w-10 opacity-80" />
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      {/* Story Timeline */}
      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <Reveal>
            <h2 className="mb-12 text-center font-display text-2xl font-bold text-sea-900 md:text-3xl">
              {t('story')}
            </h2>
          </Reveal>

          <div className="relative mx-auto max-w-4xl">
            {/* Vertical Line */}
            <div className="absolute start-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-sea-600 via-sun-400 to-sea-600 md:start-1/2" />

            {timeline.map((item, i) => (
              <Reveal key={i} delay={i * 100}>
                <div
                  className={cn(
                    'relative mb-12 flex items-center gap-8',
                    i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse',
                  )}
                >
                  <div className="absolute start-4 z-10 h-4 w-4 -translate-x-1/2 rounded-full border-4 border-sand-50 bg-sea-600 shadow-md md:start-1/2" />
                  <div className="ms-12 md:ms-0 md:w-1/2">
                    <article className="overflow-hidden border-[1.5px] border-sand-300 bg-card p-6 pin-card transition-shadow hover:shadow-sm">
                      <div className="mb-1 font-display text-lg font-bold text-sun-500">{item.year}</div>
                      <h3 className="mb-2 font-semibold text-sea-900">
                        {ar ? item.title_ar : item.title_en}
                      </h3>
                      <p className="text-sm leading-relaxed text-sea-900/60">
                        {ar ? item.desc_ar : item.desc_en}
                      </p>
                    </article>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="section-padding bg-sand-100">
        <div className="container-main">
          <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
            <Reveal>
              <article className="h-full border-[1.5px] border-sea-200 bg-sand-50 p-8 pin-card">
                <Eye className="mb-4 h-10 w-10 text-sea-600" />
                <h3 className="mb-3 font-display text-xl font-semibold text-sea-900">{t('vision')}</h3>
                <p className="leading-relaxed text-sea-900/65">{t('visionText')}</p>
              </article>
            </Reveal>
            <Reveal delay={80}>
              <article className="h-full border-[1.5px] border-sun-200 bg-sand-50 p-8 pin-card">
                <Target className="mb-4 h-10 w-10 text-sun-500" />
                <h3 className="mb-3 font-display text-xl font-semibold text-sea-900">{t('mission')}</h3>
                <p className="leading-relaxed text-sea-900/65">{t('missionText')}</p>
              </article>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Stats — matches Home trust bar */}
      <section className="border-b border-sand-200 bg-card">
        <div className="container-main">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-8 md:grid-cols-4 md:gap-x-6 md:py-12">
            {TRUST_STATS.map((stat, i) => (
              <Reveal key={i} delay={i * 70} className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-sea-50 md:p-4">
                <span aria-hidden className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-100 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 md:h-12 md:w-12">
                  {stat.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold leading-tight text-sea-900 md:text-base">
                    {ar ? stat.label_ar : stat.label_en}
                  </div>
                  <div className="mt-1 text-xs leading-snug text-sea-900/55 md:text-[0.8rem]">
                    {ar ? stat.sub_ar : stat.sub_en}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
