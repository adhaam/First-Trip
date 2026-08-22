'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { BookingForm } from '@/components/BookingForm'
import { MapPreview } from '@/components/MapPreview'
import { Reveal } from '@/components/motion/Reveal'
import { ACCOMMODATION_TAGS, WHATSAPP_NUMBER } from '@/lib/constants'
import { formatEGP } from '@/lib/pricing'
import { buildAmenityIconMap } from '@/lib/amenities'
import {
  Star, MapPin, Check, ChevronLeft, ChevronRight, ArrowLeft,
  ShieldCheck, BusFront, Mountain, MessageCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Accommodation, TransferPricing, SinaiTrip } from '@/lib/types'

const amenityIcons = buildAmenityIconMap()

export function ProductDetailClient({
  accommodation,
  pricing,
  whatsapp,
  sinaiTrips = [],
  includedTripIds = [],
}: {
  accommodation: Accommodation
  pricing: TransferPricing
  whatsapp?: string | null
  sinaiTrips?: SinaiTrip[]
  includedTripIds?: string[]
}) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [galleryIdx, setGalleryIdx] = useState(0)

  const tag = ACCOMMODATION_TAGS[accommodation.type]
  const images = accommodation.images?.length
    ? accommodation.images
    : [accommodation.image_url || '/media/heroposter.png']
  const name = ar ? accommodation.name_ar : accommodation.name_en
  const amenities = (ar ? accommodation.amenities_ar : accommodation.amenities_en) ?? []
  const location = ar
    ? accommodation.location_ar || accommodation.location
    : accommodation.location_en || accommodation.location
  const description = ar ? accommodation.description_ar : accommodation.description_en

  const digits = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const waLink = `https://wa.me/${digits}?text=${encodeURIComponent(
    ar ? `استفسار عن ${accommodation.name_ar}` : `Question about ${accommodation.name_en}`,
  )}`

  const roomRates = [accommodation.price_single_room, accommodation.price_double_room, accommodation.price_triple_room]
    .map(Number)
    .filter((price) => price > 0)
  const hasRoomPricing = roomRates.length > 0
  const cheapest = hasRoomPricing ? Math.min(...roomRates) : Number(accommodation.price_per_night) || 0

  return (
    <div className="bg-sand-50 pb-24 lg:pb-0">
      {/* ─── Gallery ─── */}
      <section className="relative bg-sea-900">
        <div className="relative aspect-[4/3] w-full sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image
            key={images[galleryIdx]}
            src={images[galleryIdx]}
            alt={name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/10 to-sea-900/40" />

          {/* back */}
          <Link
            href="/book-dahab"
            className="absolute start-4 top-4 z-10 inline-flex h-11 items-center gap-1.5 rounded-full bg-sand-50/90 px-4 text-sm font-semibold text-sea-900 backdrop-blur transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {common('back')}
          </Link>

          <span className="absolute end-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-sand-50/90 px-3.5 py-2 text-xs font-semibold text-sea-900 backdrop-blur">
            <span aria-hidden>{tag?.emoji}</span>
            {ar ? tag?.label_ar : tag?.label_en}
          </span>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setGalleryIdx((g) => (g - 1 + images.length) % images.length)}
                aria-label={ar ? 'السابق' : 'Previous'}
                className="absolute start-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35 sm:inline-flex"
              >
                <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
              </button>
              <button
                type="button"
                onClick={() => setGalleryIdx((g) => (g + 1) % images.length)}
                aria-label={ar ? 'التالي' : 'Next'}
                className="absolute end-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur transition-colors hover:bg-white/35 sm:inline-flex"
              >
                <ChevronRight className="h-5 w-5 rtl:-scale-x-100" />
              </button>
            </>
          )}

          {/* title over the image */}
          <div className="container-main absolute inset-x-0 bottom-0 pb-6">
            <h1 className="font-display text-3xl font-bold leading-tight text-white drop-shadow-sm sm:text-4xl md:text-5xl">
              {name}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-white/90">
              {location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-sun-300" />
                  {location}
                </span>
              )}
              {accommodation.type === 'hotel' && accommodation.rating > 0 && (
                <span className="inline-flex items-center gap-1">
                  {Array.from({ length: accommodation.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-sun-300 text-sun-300" />
                  ))}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* thumbnails */}
        {images.length > 1 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto bg-sea-900 px-4 pb-4 pt-3 sm:px-6 lg:px-8">
            {images.map((img, i) => (
              <button
                key={img + i}
                type="button"
                onClick={() => setGalleryIdx(i)}
                aria-label={`${i + 1}`}
                className={cn(
                  'relative h-16 w-24 shrink-0 overflow-hidden rounded-lg transition-all',
                  i === galleryIdx
                    ? 'ring-2 ring-sun-400 ring-offset-2 ring-offset-sea-900'
                    : 'opacity-55 hover:opacity-100',
                )}
              >
                <Image src={img} alt="" fill sizes="96px" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── Body ───
          Desktop (md+): two real columns — left keeps About/Amenities/Map in
          their natural order, right is a sticky sidebar with the price card
          + booking form, spanning that whole left-column height.
          Mobile: a single stack, reordered so price+form land between
          Amenities and the Map (not first, not last) — done with `order`,
          which `md:order-none` cancels once the two-column grid takes over. */}
      <div className="container-main py-10 md:py-14">
        <div className="grid gap-10 md:grid-cols-[1fr_340px] md:grid-rows-[auto_auto_auto] lg:grid-cols-[1fr_380px] lg:gap-12">
          {/* row 1, left: what's included */}
          <div className="order-1 md:order-none md:col-start-1 md:row-start-1">
            <Reveal>
              <div className="grid gap-px overflow-hidden border-[1.5px] border-sand-300 bg-sand-300 pin-card sm:grid-cols-3">
                <IncludedTile
                  icon={BusFront}
                  title={ar ? 'اختيارات انتقال' : 'Transfer choices'}
                  desc={ar ? 'باص أو هايس حسب الإعدادات المتاحة' : 'Bus or Hiace when configured and available'}
                />
                <IncludedTile
                  icon={Mountain}
                  title={ar ? 'رحلات الباكدج' : 'Package trips'}
                  desc={ar ? 'الرحلات المضمّنة بتظهر في ملخص السعر' : 'Included trips appear in the price summary'}
                />
                <IncludedTile
                  icon={ShieldCheck}
                  title={ar ? 'تأكيد قبل الدفع' : 'Confirm before payment'}
                  desc={ar ? 'السعر النهائي بيتأكد معاك أولاً' : 'Your final total is confirmed with you first'}
                />
              </div>
            </Reveal>
          </div>

          {/* row 2, left: description + amenities */}
          <div className="order-2 md:order-none md:col-start-1 md:row-start-2 mt-10 space-y-12 md:mt-0">
            {description && (
              <Reveal>
                <h2 className="font-display text-xl font-bold text-sea-900">{t('aboutTrip')}</h2>
                <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-loose text-sea-900/70">
                  {description}
                </p>
              </Reveal>
            )}

            {amenities.length > 0 && (
              <Reveal>
                <h2 className="font-display text-xl font-bold text-sea-900">{t('highlights')}</h2>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {amenities.map((amenity, i) => {
                    const Icon = amenityIcons[amenity] || Check
                    return (
                      <li
                        key={i}
                        className="flex items-center gap-3 rounded-xl border border-sand-300 bg-card px-4 py-3"
                      >
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sea-50 text-sea-600">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-medium text-sea-900/80">{amenity}</span>
                      </li>
                    )
                  })}
                </ul>
              </Reveal>
            )}
          </div>

          {/* right column: price card + booking form — sticky, spans the left column's height */}
          <div className="order-3 md:order-none md:col-start-2 md:row-start-1 md:row-span-3 mt-10 md:mt-0">
            <div className="space-y-5 md:sticky md:top-24">
              <div className="overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
                <div className="space-y-2.5 p-6">
                  {hasRoomPricing ? (
                    <>
                      {Number(accommodation.price_single_room) > 0 && <PriceRow label={ar ? 'غرفة سينجل' : 'Single room'} sub={ar ? 'إجمالي الغرفة لكل ليلة' : 'Total room price per night'} value={formatEGP(Number(accommodation.price_single_room), locale)} currency={common('egp')} />}
                      {Number(accommodation.price_double_room) > 0 && <PriceRow label={ar ? 'غرفة دبل' : 'Double room'} sub={ar ? 'إجمالي الغرفة لكل ليلة' : 'Total room price per night'} value={formatEGP(Number(accommodation.price_double_room), locale)} currency={common('egp')} highlight />}
                      {Number(accommodation.price_triple_room) > 0 && <PriceRow label={ar ? 'غرفة تريبل' : 'Triple room'} sub={ar ? 'إجمالي الغرفة لكل ليلة' : 'Total room price per night'} value={formatEGP(Number(accommodation.price_triple_room), locale)} currency={common('egp')} />}
                    </>
                  ) : (
                    <PriceRow label={ar ? 'إقامة فقط' : 'Stay only'} sub={`${t('perNight')} · ${t('perPerson')}`} value={formatEGP(Number(accommodation.price_per_night), locale)} currency={common('egp')} />
                  )}
                </div>

                <div className="border-t border-sand-300 bg-sand-100 px-6 py-4">
                  <p className="text-xs leading-relaxed text-sea-900/55">
                    {accommodation.seasonal_rates?.length
                      ? (ar ? 'الفترات الموسمية بتتحسب ليلة بليلة في نموذج الحجز.' : 'Seasonal periods are calculated night by night in the booking form.')
                      : (ar ? 'اختار التواريخ والتفاصيل تحت علشان تشوف الملخص الكامل.' : 'Choose dates and details below to see the full calculated summary.')}
                  </p>
                </div>
              </div>

              <div id="booking-form">
                <BookingForm
                  accommodation={accommodation}
                  pricing={pricing}
                  whatsapp={whatsapp}
                  sinaiTrips={sinaiTrips}
                  includedTripIds={includedTripIds}
                />
              </div>
            </div>
          </div>

          {/* row 3, left: map */}
          <div className="order-4 md:order-none md:col-start-1 md:row-start-3 mt-10 md:mt-0">
            <Reveal>
              <MapPreview
                latitude={accommodation.latitude}
                longitude={accommodation.longitude}
                label={location}
              />
            </Reveal>
          </div>
        </div>
      </div>

      {/* ─── Mobile sticky bar ─── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sand-300 bg-sand-50/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[0.65rem] uppercase tracking-wider text-sea-900/45">
              {t('priceStartsFrom')}
            </div>
            <div className="truncate font-display text-lg font-bold text-sea-900">
              {formatEGP(cheapest, locale)}{' '}
              <span className="text-xs font-semibold text-sea-900/70">{common('egp')}</span>
            </div>
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noopener"
            aria-label="WhatsApp"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#25D366] text-[#128C4A]"
          >
            <MessageCircle className="h-5 w-5" />
          </a>
          <a
            href="#booking-form"
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-sun-400 px-6 text-sm font-semibold text-white"
          >
            {ar ? 'احجز' : 'Book'}
          </a>
        </div>
      </div>
    </div>
  )
}

function IncludedTile({
  icon: Icon,
  title,
  desc,
}: {
  icon: LucideIcon
  title: string
  desc: string
}) {
  return (
    <div className="bg-card p-5">
      <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sun-50 text-sun-500">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="font-display text-sm font-bold text-sea-900">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-sea-900/55">{desc}</p>
    </div>
  )
}

function PriceRow({
  label,
  sub,
  value,
  currency,
  highlight = false,
}: {
  label: string
  sub: string
  value: string
  currency: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border px-4 py-3.5',
        highlight ? 'border-sun-300 bg-sun-50' : 'border-sand-300 bg-sand-50',
      )}
    >
      <div className="min-w-0">
        <div className="text-sm font-semibold text-sea-900">{label}</div>
        <div className="mt-0.5 text-xs text-sea-900/50">{sub}</div>
      </div>
      <div className="shrink-0 text-end">
        <span className="font-display text-lg font-bold text-sea-900">{value}</span>{' '}
        <span className="text-xs font-semibold text-sea-900/60">{currency}</span>
      </div>
    </div>
  )
}
