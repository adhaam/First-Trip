'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, type Variants } from 'framer-motion'
import { MOCK_ACCOMMODATIONS } from '@/lib/mock-data'
import { ACCOMMODATION_TAGS, PLACEHOLDER_IMAGES } from '@/lib/constants'
import { Star, MapPin, Calendar, SlidersHorizontal, ArrowUpDown } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const }
  })
}

export default function BookDahabPage() {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('default')

  const filtered = MOCK_ACCOMMODATIONS.filter(a => {
    if (!a.is_active) return false
    if (filterType !== 'all' && a.type !== filterType) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price_per_night - b.price_per_night
    if (sortBy === 'price-desc') return b.price_per_night - a.price_per_night
    return 0 // default order
  })

  return (
    <div>
      {/* ─── Hero Banner ─── */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src={PLACEHOLDER_IMAGES.dahab1} alt="" fill className="object-cover" />
        </div>
        <div className="container-main relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">{t('subtitle')}</p>
          </motion.div>
        </div>
      </section>

      {/* ─── Photo Gallery ─── */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-gray-900 mb-8"
          >
            {t('gallery')}
          </motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[180px]">
            {/* Masonry-style grid */}
            {[
              { src: PLACEHOLDER_IMAGES.dahab1, span: 'col-span-2 row-span-2' },
              { src: PLACEHOLDER_IMAGES.dahab2, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.dahab3, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.diving, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.desert2, span: 'col-span-1 row-span-1' },
            ].map((img, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={cn('relative overflow-hidden rounded-xl group', img.span)}
              >
                <Image
                  src={img.src}
                  alt=""
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About Trip + Schedule ─── */}
      <section className="section-padding bg-gray-50">
        <div className="container-main">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: locale === 'ar' ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                {t('aboutTrip')}
              </h2>
              <p className="text-gray-600 leading-relaxed mb-6">
                {locale === 'ar'
                  ? 'رحلات First Trip لدهب هي تجربة سياحية متكاملة. بنوفرلك انتقالات مريحة من محافظتك، إقامة في أفضل الفنادق والشاليهات والكمبات، مع رحلتين داخليتين مجاناً. الرحلة مناسبة للأفراد والعائلات والمجموعات.'
                  : 'First Trip Dahab packages offer a complete tourism experience. We provide comfortable transfers from your governorate, accommodation in the best hotels, chalets & camps, plus 2 free internal trips. Suitable for individuals, families & groups.'}
              </p>
              <div className="flex items-center gap-2 text-brand-orange">
                <Calendar className="h-5 w-5" />
                <span className="font-medium">{t('schedule')}</span>
              </div>
              <p className="text-gray-500 text-sm mt-1">{t('scheduleText')}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: locale === 'ar' ? 30 : -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-2xl p-8 shadow-sm border"
            >
              <h3 className="font-bold text-gray-900 mb-6 text-lg">
                {locale === 'ar' ? 'تواريخ الرحلات المتاحة' : 'Available Trip Dates'}
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-brand-blue/5 rounded-xl">
                  <div>
                    <div className="font-medium text-gray-900">
                      {locale === 'ar' ? 'كل يوم خميس' : 'Every Thursday'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {locale === 'ar' ? '4 أيام (خميس → اثنين)' : '4 Days (Thu → Mon)'}
                    </div>
                  </div>
                  <Badge className="bg-brand-blue text-white">{t('day4')}</Badge>
                </div>
                <div className="flex items-center justify-between p-4 bg-brand-orange/5 rounded-xl">
                  <div>
                    <div className="font-medium text-gray-900">
                      {locale === 'ar' ? 'كل يوم أحد' : 'Every Sunday'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {locale === 'ar' ? '5 أيام (أحد → جمعة)' : '5 Days (Sun → Fri)'}
                    </div>
                  </div>
                  <Badge className="bg-brand-orange text-white">{t('day5')}</Badge>
                </div>
              </div>
              <div className="mt-4 text-sm text-gray-400 text-center">
                {locale === 'ar' ? 'التواريخ متاحة على مدار السنة' : 'Dates available year-round'}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ─── Accommodations Grid ─── */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('accommodations')}</h2>
          </motion.div>

          {/* Filters & Sort */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
              {[
                { key: 'all', label_ar: 'الكل', label_en: 'All' },
                { key: 'hotel', label_ar: '🏨 فنادق', label_en: '🏨 Hotels' },
                { key: 'chalet', label_ar: '🏖️ شاليهات', label_en: '🏖️ Chalets' },
                { key: 'camp', label_ar: '🏕️ كمبات', label_en: '🏕️ Camps' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    filterType === f.key
                      ? 'bg-white text-brand-blue shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {locale === 'ar' ? f.label_ar : f.label_en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5 bg-gray-100 rounded-full p-1">
              <ArrowUpDown className="h-4 w-4 text-gray-400 ml-2" />
              {[
                { key: 'default', label_ar: 'الافتراضي', label_en: 'Default' },
                { key: 'price-asc', label_ar: 'السعر ↓', label_en: 'Price ↓' },
                { key: 'price-desc', label_ar: 'السعر ↑', label_en: 'Price ↑' },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={cn(
                    'px-3 py-2 rounded-full text-xs font-medium transition-colors',
                    sortBy === s.key
                      ? 'bg-white text-brand-blue shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  {locale === 'ar' ? s.label_ar : s.label_en}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-400">
              {sorted.length} {locale === 'ar' ? 'مكان إقامة' : 'places'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {sorted.map((acc, i) => {
              const tag = ACCOMMODATION_TAGS[acc.type]
              return (
                <motion.div
                  key={acc.id}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  custom={i}
                >
                  <Link href={`/book-dahab/${acc.id}`}>
                    <Card className="group h-full overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                      <div className="relative h-48 overflow-hidden">
                        <Image
                          src={acc.images[0]}
                          alt={locale === 'ar' ? acc.name_ar : acc.name_en}
                          fill
                          className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        {/* Type Tag */}
                        <div className="absolute top-3 left-3 z-10">
                          <Badge className="bg-white/90 text-gray-800 shadow-sm text-xs px-2.5 py-1">
                            <span className="mr-1">{tag.emoji}</span>
                            <span>{locale === 'ar' ? tag.label_ar : tag.label_en}</span>
                          </Badge>
                        </div>
                        {/* Rating */}
                        {acc.type === 'hotel' && (
                          <div className="absolute top-3 right-3 z-10 flex gap-0.5">
                            {Array.from({ length: acc.rating }).map((_, i) => (
                              <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                            ))}
                          </div>
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-bold text-gray-900 mb-1">
                          {locale === 'ar' ? acc.name_ar : acc.name_en}
                        </h3>
                        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                          <MapPin className="h-3 w-3" />
                          <span>{acc.location}</span>
                        </div>
                        <div className="text-brand-orange font-bold">
                          {t('priceStartsFrom')}{' '}
                          <span className="text-lg">{acc.price_per_night} {common('egp')}</span>
                        </div>
                        <div className="text-xs text-gray-400">{t('perNight')}</div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex gap-2">
                        <Button size="sm" className="flex-1 bg-brand-blue hover:bg-brand-blue-dark text-xs">
                          {t('package4')}
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs">
                          {t('package5')}
                        </Button>
                      </CardFooter>
                    </Card>
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Quick CTA ─── */}
      <section className="py-16 bg-gradient-to-r from-brand-blue to-brand-orange text-white text-center">
        <div className="container-main">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl md:text-3xl font-bold mb-2">
              {locale === 'ar' ? 'احجز دلوقتي وخلّي الباقي علينا!' : 'Book now and leave the rest to us!'}
            </h2>
            <p className="text-white/80 mb-6">
              {locale === 'ar' ? 'تواصل معانا على واتساب للحجز الفوري' : 'Contact us on WhatsApp for instant booking'}
            </p>
            <div className="flex justify-center gap-4">
              <a
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center h-12 px-8 rounded-full text-lg font-medium bg-white text-brand-blue hover:bg-gray-100 transition-all"
              >
                💬 WhatsApp
              </a>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  )
}