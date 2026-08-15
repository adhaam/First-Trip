'use client'

import { useLocale } from 'next-intl'
import Image from 'next/image'
import { Reveal } from '@/components/motion/Reveal'
import { WaveDivider } from '@/components/brand/Section'
import { PLACEHOLDER_IMAGES, WHATSAPP_NUMBER } from '@/lib/constants'
import { Bike, Sparkles, MessageCircle } from 'lucide-react'

const categories = [
  { emoji: '🚲', label_ar: 'عجل', label_en: 'Bikes' },
  { emoji: '🚗', label_ar: 'عربيات', label_en: 'Cars' },
  { emoji: '🛵', label_ar: 'سكوترات', label_en: 'Scooters' },
  { emoji: '🏖️', label_ar: 'معدات بيتش', label_en: 'Beach gear' },
  { emoji: '🤿', label_ar: 'معدات سنوركلينج', label_en: 'Snorkeling equipment' },
  { emoji: '🏄', label_ar: 'بادل بورد', label_en: 'Paddle boards' },
  { emoji: '⛺', label_ar: 'خيم', label_en: 'Tents' },
  { emoji: '🎒', label_ar: 'معدات تخييم', label_en: 'Camping gear' },
]

export function RentClient() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const whatsapp = WHATSAPP_NUMBER.replace(/[^0-9]/g, '')

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src={PLACEHOLDER_IMAGES.dahab2} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {ar ? 'إيجار في دهب' : 'Rentals in Dahab'}
          </span>
          <Bike className="mx-auto mb-4 h-10 w-10 opacity-80" />
          <h1 className="font-display text-4xl font-bold sm:text-5xl">
            {ar ? 'إيجار المعدات — قريباً' : 'Gear Rentals — Coming Soon'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">
            {ar
              ? 'من عجلة تتفسح بيها على الكورنيش لعربية تودّيك لسانت كاترين — كل حاجة هتحتاجها في دهب، من غير ما تجيب حاجة من بيتك.'
              : "From a bike to explore the promenade to a car for Saint Catherine — everything you'll need in Dahab, no need to bring your own."}
          </p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      {/* Coming soon badge */}
      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <Reveal>
            <div className="mx-auto mb-10 flex max-w-md items-center justify-center gap-2 rounded-full border border-sun-300 bg-sun-50 px-6 py-3 text-center">
              <Sparkles className="h-4 w-4 text-sun-500" />
              <span className="text-sm font-semibold text-sea-900">
                {ar ? 'شغالين عليها دلوقتي — تابعنا عشان تعرف الأول' : "We're working on it — follow us to be the first to know"}
              </span>
            </div>
          </Reveal>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((c, i) => (
              <Reveal key={i} delay={i * 70}>
                <article className="flex flex-col items-center gap-3 border-[1.5px] border-sand-300 bg-card p-6 text-center pin-card transition-shadow hover:shadow-sm">
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sea-100 text-2xl">
                    {c.emoji}
                  </span>
                  <div>
                    <h3 className="font-display text-sm font-semibold text-sea-900">
                      {ar ? c.label_ar : c.label_en}
                    </h3>
                    <p className="mt-0.5 text-xs text-sea-900/50">
                      {ar ? 'قريباً' : 'Coming soon'}
                    </p>
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden bg-sun-400 py-16 text-center text-white">
        <div className="container-main relative">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {ar ? 'محتاج تأجير حاجة دلوقتي؟' : 'Need to rent something right now?'}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-white/85">
            {ar ? 'كلمنا على واتساب — ممكن نرشحلك حد موثوق في دهب لحد ما نطلق الخدمة' : "Message us on WhatsApp — we can recommend someone trusted in Dahab until we launch"}
          </p>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-sea-900 px-7 text-sm font-semibold text-white transition-colors hover:bg-sea-700"
          >
            <MessageCircle className="h-4 w-4" />
            {ar ? 'كلمنا على واتساب' : 'Message us on WhatsApp'}
          </a>
        </div>
      </section>
    </div>
  )
}
