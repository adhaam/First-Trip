'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { motion, AnimatePresence } from 'framer-motion'
import { ACCOMMODATION_TAGS, WHATSAPP_NUMBER } from '@/lib/constants'
import { BookingForm } from '@/components/BookingForm'
import {
  Star, MapPin, ChevronLeft, ChevronRight, Check,
  Wifi, Utensils, Waves, Thermometer, TreePine
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import type { Accommodation } from '@/lib/types'

const amenityIcons: Record<string, LucideIcon> = {
  'حمام سباحة': Waves, 'Swimming Pool': Waves,
  'واي فاي مجاني': Wifi, 'Free WiFi': Wifi,
  'إفطار مجاني': Utensils, 'Free Breakfast': Utensils,
  'إطلالة على البحر': Waves, 'Sea View': Waves,
  'تكييف': Thermometer, 'Air Conditioning': Thermometer,
  'مطبخ مجهز': Utensils, 'Equipped Kitchen': Utensils,
  'حديقة خاصة': TreePine, 'Private Garden': TreePine,
  'مباشرة على البحر': Waves, 'Beachfront': Waves,
  'شواية باربيكيو': Utensils, 'BBQ Grill': Utensils,
  'جلسة بدوية': TreePine, 'Bedouin Seating': TreePine,
  'شاي بدوي مجاني': TreePine, 'Free Bedouin Tea': TreePine,
  'حمام سباحة دافء': Waves, 'Heated Pool': Waves,
  'مركز غوص خاص': Waves, 'Private Dive Center': Waves,
  'شاطئ خاص': Waves, 'Private Beach': Waves,
  'جيم وسبا': Thermometer, 'Gym & Spa': Thermometer,
  'بوفيه مفتوح': Utensils, 'Open Buffet': Utensils,
}

export function ProductDetailClient({ accommodation }: { accommodation: Accommodation }) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const [galleryIdx, setGalleryIdx] = useState(0)
  const [showBooking, setShowBooking] = useState(false)

  const tag = ACCOMMODATION_TAGS[accommodation.type]
  const images = accommodation.images
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const amenities = locale === 'ar' ? accommodation.amenities_ar : accommodation.amenities_en
  const location = locale === 'ar' ? (accommodation.location_ar || accommodation.location) : (accommodation.location_en || accommodation.location)

  return (
    <div>
      {/* ─── Header Image Gallery ─── */}
      <section className="relative h-[50vh] md:h-[60vh] bg-gray-900">
        <AnimatePresence mode="wait">
          <motion.div
            key={galleryIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0"
          >
            <Image src={images[galleryIdx]} alt="" fill className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </motion.div>
        </AnimatePresence>

        {images.length > 1 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
            <Button
              variant="ghost" size="icon"
              onClick={() => setGalleryIdx(g => (g - 1 + images.length) % images.length)}
              className="rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setGalleryIdx(i)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i === galleryIdx ? 'bg-white w-4' : 'bg-white/40'
                  )}
                />
              ))}
            </div>
            <Button
              variant="ghost" size="icon"
              onClick={() => setGalleryIdx(g => (g + 1) % images.length)}
              className="rounded-full bg-white/20 hover:bg-white/30 text-white"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}

        <div className="absolute top-6 left-6 z-10">
          <Badge className="bg-white/90 text-gray-800 text-sm px-3 py-1.5 shadow-sm">
            <span className="mr-1">{tag.emoji}</span>
            {locale === 'ar' ? tag.label_ar : tag.label_en}
          </Badge>
        </div>

        <Link
          href="/book-dahab"
          className="absolute top-6 right-6 z-10 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white rounded-full p-2 transition-colors"
          dir={dir}
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      </section>

      <div className="container-main py-8">
        <div className="grid lg:grid-cols-5 gap-8">
          {/* ─── Main Content ─── */}
          <div className="lg:col-span-3 space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                {locale === 'ar' ? accommodation.name_ar : accommodation.name_en}
              </h1>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <MapPin className="h-4 w-4 text-brand-blue" />
                  <span>{location}</span>
                </div>
                {accommodation.type === 'hotel' && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: accommodation.rating }).map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>

            <Separator />

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <p className="text-gray-600 leading-relaxed">
                {locale === 'ar' ? accommodation.description_ar : accommodation.description_en}
              </p>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-bold text-gray-900 mb-3">
                {locale === 'ar' ? 'الخدمات والمميزات' : 'Services & Amenities'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {amenities.map((amenity, i) => {
                  const Icon = amenityIcons[amenity] || Check
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-8 h-8 rounded-lg bg-brand-blue/10 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-brand-blue" />
                      </div>
                      <span>{amenity}</span>
                    </div>
                  )
                })}
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h3 className="font-bold text-gray-900 mb-3">
                {locale === 'ar' ? 'الموقع' : 'Location'}
              </h3>
              <div className="h-48 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                <MapPin className="h-5 w-5 mr-1" />
                {location}
              </div>
            </motion.div>
          </div>

          {/* ─── Price Sidebar ─── */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-24 space-y-4"
            >
              <Card className="shadow-sm border">
                <CardContent className="p-6 space-y-4">
                  <div className="p-4 rounded-xl bg-gray-50">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {locale === 'ar' ? 'إقامة فقط' : 'Accommodation Only'}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-brand-blue">
                          {accommodation.price_per_night} {common('egp')}
                        </div>
                        <div className="text-xs text-gray-400">/{t('perNight')} /{t('perPerson')}</div>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-brand-blue/5 border border-brand-blue/20">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {locale === 'ar' ? 'باكدج 4 أيام' : '4-Day Package'}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-brand-blue">
                          {accommodation.price_4day} {common('egp')}
                        </div>
                        <div className="text-xs text-gray-400">/{t('perPerson')}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {locale === 'ar' ? 'انتقالات + إقامة + رحلتين داخليتين' : 'Transfer + Stay + 2 internal trips'}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-brand-orange/5 border border-brand-orange/20">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-gray-900 text-sm">
                        {locale === 'ar' ? 'باكدج 5 أيام' : '5-Day Package'}
                      </span>
                      <div className="text-right">
                        <div className="text-lg font-bold text-brand-orange">
                          {accommodation.price_5day} {common('egp')}
                        </div>
                        <div className="text-xs text-gray-400">/{t('perPerson')}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {locale === 'ar' ? 'انتقالات + إقامة + رحلتين داخليتين' : 'Transfer + Stay + 2 internal trips'}
                    </div>
                  </div>

                  <Separator />

                  <Button
                    className="w-full bg-brand-orange hover:bg-brand-orange-dark text-white"
                    size="lg"
                    onClick={() => setShowBooking(!showBooking)}
                  >
                    {locale === 'ar' ? 'احجز الآن' : 'Book Now'}
                  </Button>
                  <a
                    href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${encodeURIComponent(locale === 'ar' ? `حجز ${accommodation.name_ar}` : `Booking ${accommodation.name_en}`)}`}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center h-11 px-4 rounded-full font-medium border border-green-500 text-green-600 hover:bg-green-50 transition-all w-full"
                  >
                    💬 {t('whatsappBooking')}
                  </a>
                </CardContent>
              </Card>

              {showBooking && <BookingForm accommodation={accommodation} />}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
