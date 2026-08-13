'use client'

import { useTranslations, useLocale } from 'next-intl'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { WaveDivider } from '@/components/brand/Section'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { Compass, Eye, Target, Award, Users, Star, MapPin } from 'lucide-react'

const timeline = [
  { year: '2017', title_ar: 'التأسيس', title_en: 'Founded', desc_ar: 'انطلاق First Trip كشركة سياحة متخصصة في رحلات دهب من المحافظات', desc_en: 'First Trip launched as a tourism company specializing in Dahab trips from governorates' },
  { year: '2017-2023', title_ar: 'النمو والاستمرارية', title_en: 'Growth & Continuity', desc_ar: '6 سنوات من تنظيم مئات الرحلات وكسب ثقة آلاف العملاء', desc_en: '6 years of organizing hundreds of trips & earning trust of thousands of customers' },
  { year: '2023', title_ar: 'توقف مؤقت', title_en: 'Temporary Pause', desc_ar: 'إغلاق مؤقت لإعادة التنظيم والتخطيط لإعادة الإطلاق', desc_en: 'Temporary pause for reorganization and relaunch planning' },
  { year: '2026', title_ar: 'إعادة الإطلاق', title_en: 'Relaunch', desc_ar: 'العودة بقوة أكبر مع تقنيات عصرية وخدمات محسّنة', desc_en: 'Strong return with modern tech and enhanced services' },
]

const stats = [
  { value: '6+', label_ar: 'سنوات خبرة', label_en: 'Years Experience', icon: Award },
  { value: '500+', label_ar: 'عميل سعيد', label_en: 'Happy Customers', icon: Users },
  { value: '30+', label_ar: 'مكان إقامة', label_en: 'Accommodations', icon: MapPin },
  { value: '5★', label_ar: 'تقييم العملاء', label_en: 'Customer Rating', icon: Star },
]

export default function AboutPage() {
  const t = useTranslations('about')
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src={PLACEHOLDER_IMAGES.camping} alt="" fill className="object-cover" />
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

      {/* Stats */}
      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sea-100">
                    <s.icon className="h-6 w-6 text-sea-600" />
                  </div>
                  <div className="mb-1 font-display text-3xl font-bold text-sea-900 md:text-4xl">
                    {s.value}
                  </div>
                  <div className="text-sm text-sea-900/55">
                    {ar ? s.label_ar : s.label_en}
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
