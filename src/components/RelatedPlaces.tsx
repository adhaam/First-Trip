'use client'

import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import type { Accommodation } from '@/lib/types'
import { ACCOMMODATION_TAGS } from '@/lib/constants'
import Image from 'next/image'

interface Props {
  related: Accommodation[]
}

export function RelatedPlaces({ related }: Props) {
  const locale = useLocale()

  if (related.length === 0) return null

  return (
    <section className="section-padding bg-gray-50">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
            {locale === 'ar' ? 'أماكن مشابهة قد تعجبك' : 'You Might Also Like'}
          </h2>
        </motion.div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {related.map((rel, i) => {
            const tag = ACCOMMODATION_TAGS[rel.type]
            return (
              <motion.div
                key={rel.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Link href={`/book-dahab/${rel.id}`}>
                  <Card className="h-full overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                    <div className="relative h-44 overflow-hidden">
                      <Image src={rel.images[0]} alt="" fill className="object-cover" />
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-white/90 text-gray-800 text-xs">
                          {tag.emoji} {locale === 'ar' ? tag.label_ar : tag.label_en}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h4 className="font-bold text-gray-900 text-sm mb-1">
                        {locale === 'ar' ? rel.name_ar : rel.name_en}
                      </h4>
                      <div className="flex items-center justify-between">
                        <span className="text-brand-orange font-bold text-sm">
                          {rel.price_per_night.toLocaleString()} ج.م
                        </span>
                        <span className="text-xs text-gray-400">/{locale === 'ar' ? 'ليلة' : 'night'}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
