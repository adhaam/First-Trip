import { getTranslations } from 'next-intl/server'
import { Badge } from '@/components/ui/badge'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { Calendar } from 'lucide-react'
import Image from 'next/image'
import { getAccommodations } from '@/lib/data'
import { BookDahabClient } from '@/components/BookDahabClient'

export const revalidate = 60

export default async function BookDahabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('book')
  const accommodations = await getAccommodations()

  return (
    <div>
      {/* ─── Hero Banner ─── */}
      <section className="relative py-20 md:py-28 bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src={PLACEHOLDER_IMAGES.dahab1} alt="" fill className="object-cover" />
        </div>
        <div className="container-main relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </section>

      {/* ─── Photo Gallery ─── */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8">{t('gallery')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[180px]">
            {[
              { src: PLACEHOLDER_IMAGES.dahab1, span: 'col-span-2 row-span-2' },
              { src: PLACEHOLDER_IMAGES.dahab2, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.dahab3, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.diving, span: 'col-span-1 row-span-1' },
              { src: PLACEHOLDER_IMAGES.desert2, span: 'col-span-1 row-span-1' },
            ].map((img, i) => (
              <div key={i} className={`relative overflow-hidden rounded-xl group ${img.span}`}>
                <Image src={img.src} alt="" fill className="object-cover transition-transform duration-500 group-hover:scale-110" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── About Trip + Schedule ─── */}
      <section className="section-padding bg-gray-50">
        <div className="container-main">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">{t('aboutTrip')}</h2>
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
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border">
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
            </div>
          </div>
        </div>
      </section>

      {/* ─── Accommodations Grid ─── */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{t('accommodations')}</h2>
          </div>
          <BookDahabClient accommodations={accommodations} />
        </div>
      </section>

      {/* ─── Quick CTA ─── */}
      <section className="py-16 bg-gradient-to-r from-brand-blue to-brand-orange text-white text-center">
        <div className="container-main">
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
        </div>
      </section>
    </div>
  )
}
