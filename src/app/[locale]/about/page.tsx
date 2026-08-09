'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
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

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white py-20 md:py-28 text-center">
        <div className="container-main">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Compass className="h-12 w-12 mx-auto mb-4 opacity-90" />
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
          </motion.div>
        </div>
      </section>

      {/* Story Timeline */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-12 text-center">
            {t('story')}
          </h2>

          <div className="relative max-w-4xl mx-auto">
            {/* Vertical Line */}
            <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-brand-blue via-brand-orange to-brand-blue" />

            {timeline.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className={`relative flex items-center gap-8 mb-12 ${
                  i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                <div className="absolute left-4 md:left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-blue border-4 border-white shadow-md z-10" />
                <div className="ml-12 md:ml-0 md:w-1/2">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="text-brand-orange font-bold text-lg mb-1">{item.year}</div>
                      <h3 className="font-bold text-gray-900 mb-2">
                        {locale === 'ar' ? item.title_ar : item.title_en}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {locale === 'ar' ? item.desc_ar : item.desc_en}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Vision & Mission */}
      <section className="section-padding bg-gray-50">
        <div className="container-main">
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="h-full border-brand-blue/20">
                <CardContent className="p-8">
                  <Eye className="h-10 w-10 text-brand-blue mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{t('vision')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('visionText')}</p>
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <Card className="h-full border-brand-orange/20">
                <CardContent className="p-8">
                  <Target className="h-10 w-10 text-brand-orange mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{t('mission')}</h3>
                  <p className="text-gray-600 leading-relaxed">{t('missionText')}</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-brand-blue/10 flex items-center justify-center">
                  <s.icon className="h-6 w-6 text-brand-blue" />
                </div>
                <div className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-1">
                  {s.value}
                </div>
                <div className="text-sm text-gray-500">
                  {locale === 'ar' ? s.label_ar : s.label_en}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}