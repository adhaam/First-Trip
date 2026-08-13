'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion, type Variants } from 'framer-motion'
import { ACCOMMODATION_TAGS } from '@/lib/constants'
import { Star, MapPin, ArrowUpDown } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Accommodation } from '@/lib/types'

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' as const }
  })
}

export function BookDahabClient({ accommodations }: { accommodations: Accommodation[] }) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('default')

  const filtered = accommodations.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'price-asc') return a.price_per_night - b.price_per_night
    if (sortBy === 'price-desc') return b.price_per_night - a.price_per_night
    return 0
  })

  return (
    <>
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

      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {locale === 'ar' ? 'لا توجد أماكن إقامة متاحة حالياً' : 'No accommodations available right now'}
        </div>
      ) : (
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
                      <div className="absolute top-3 left-3 z-10">
                        <Badge className="bg-white/90 text-gray-800 shadow-sm text-xs px-2.5 py-1">
                          <span className="mr-1">{tag.emoji}</span>
                          <span>{locale === 'ar' ? tag.label_ar : tag.label_en}</span>
                        </Badge>
                      </div>
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
                        <span>{locale === 'ar' ? (acc.location_ar || acc.location) : (acc.location_en || acc.location)}</span>
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
      )}
    </>
  )
}
