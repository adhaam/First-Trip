'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { MOCK_SINAI_TRIPS } from '@/lib/mock-data'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { Clock, Check, Filter } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export default function SinaiTripsPage() {
  const t = useTranslations('sinai')
  const common = useTranslations('common')
  const locale = useLocale()
  const [filter, setFilter] = useState<string>('all')

  const categories = [
    { id: 'all', label_ar: 'كل الرحلات', label_en: 'All Trips' },
    ...Array.from(new Set(MOCK_SINAI_TRIPS.map(t => locale === 'ar' ? t.category_ar : t.category_en)))
      .map(c => ({ id: c, label_ar: c, label_en: c }))
  ]

  const filtered = filter === 'all'
    ? MOCK_SINAI_TRIPS
    : MOCK_SINAI_TRIPS.filter(trip => (locale === 'ar' ? trip.category_ar : trip.category_en) === filter)

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white py-20 md:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <Image src="https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=1920&q=80" alt="" fill className="object-cover" />
        </div>
        <div className="container-main relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
            <p className="text-lg text-orange-100 max-w-2xl mx-auto">{t('subtitle')}</p>
          </motion.div>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="section-padding bg-gray-50">
        <div className="container-main">
          {/* Filter Bar */}
          <div className="mb-8 flex items-center gap-3 overflow-x-auto pb-2">
            <Filter className="h-5 w-5 text-gray-400 flex-shrink-0" />
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                className={cn(
                  'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  filter === cat.id
                    ? 'bg-brand-blue text-white shadow-sm'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border'
                )}
              >
                {cat.id === 'all' ? (locale === 'ar' ? cat.label_ar : cat.label_en) : cat.id}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((trip, i) => (
              <motion.div
                key={trip.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="group h-full overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={trip.images[0]}
                      alt={locale === 'ar' ? trip.name_ar : trip.name_en}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <Badge className="absolute top-3 left-3 bg-white/90 text-gray-800">
                      {locale === 'ar' ? trip.category_ar : trip.category_en}
                    </Badge>
                  </div>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-gray-900 mb-2">
                      {locale === 'ar' ? trip.name_ar : trip.name_en}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{locale === 'ar' ? trip.duration : trip.duration_en}</span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2 mb-4">
                      {locale === 'ar' ? trip.description_ar : trip.description_en}
                    </p>

                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold text-gray-700 mb-2">{t('includes')}:</div>
                      <div className="space-y-1">
                        {(locale === 'ar' ? trip.includes_ar : trip.includes_en).slice(0, 3).map((inc, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Check className="h-3 w-3 text-green-500 flex-shrink-0" />
                            <span>{inc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="p-5 pt-0 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-gray-400">{t('price')}</div>
                      <div className="text-xl font-bold text-brand-orange">
                        {trip.price} {common('egp')}
                      </div>
                      <div className="text-xs text-gray-400">/{t('bookNow').toLowerCase()}</div>
                    </div>
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodeURIComponent(`Booking: ${locale === 'ar' ? trip.name_ar : trip.name_en}`)}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center justify-center h-9 px-4 rounded-full font-medium bg-brand-blue hover:bg-brand-blue-dark text-white transition-all"
                    >
                      {t('bookNow')}
                    </a>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}