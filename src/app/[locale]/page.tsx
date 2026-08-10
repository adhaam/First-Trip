'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ButtonLink } from '@/components/ButtonLink'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { BrandPattern } from '@/components/BrandPattern'
import { motion, type Variants } from 'framer-motion'
import {
  SERVICES, WHY_US, TESTIMONIALS, TRUST_STATS,
  WHATSAPP_NUMBER, PLACEHOLDER_IMAGES
} from '@/lib/constants'
import { Star, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { useState, useCallback } from 'react'
type T = ReturnType<typeof useTranslations>
type Props = { t: T; locale: string }

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const }
  })
}

export default function HomePage() {
  const t = useTranslations()
  const locale = useLocale()

  return (
    <div className="overflow-hidden">
      {/* Brand Pattern Background */}
      <BrandPattern />

      {/* ─── HERO ─── */}
      <HeroSection t={t} locale={locale} />

      {/* ─── TRUST BAR ─── */}
      <TrustBar />

      {/* ─── SERVICES ─── */}
      <ServicesSection t={t} locale={locale} />

      {/* ─── WHY FIRST TRIP ─── */}
      <WhyUsSection t={t} locale={locale} />

      {/* ─── TESTIMONIALS ─── */}
      <TestimonialsSection t={t} locale={locale} />

      {/* ─── DAHAB QUICK GUIDE ─── */}
      <DahabGuideSection t={t} locale={locale} />

      {/* ─── FINAL CTA ─── */}
      <FinalCtaSection t={t} locale={locale} />
    </div>
  )
}

/* ──────── Hero Section — New Design ──────── */
function HeroSection({ t, locale }: Props) {
  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden bg-brand-blue-dark">
      {/* Background Image — moves with parallax */}
      <div className="absolute inset-0 z-0 scale-110" style={{ willChange: 'transform' }}>
        <Image
          src={PLACEHOLDER_IMAGES.hero}
          alt="Dahab"
          fill
          className="object-cover opacity-70"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-b from-brand-blue/80 via-brand-blue-dark/60 to-brand-blue-dark/90" />
      </div>

      {/* Floating Dahab Elements (subtle) */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <div className="absolute top-[15%] left-[5%] text-4xl opacity-20 animate-bounce" style={{ animationDuration: '6s' }}>🐪</div>
        <div className="absolute top-[25%] right-[8%] text-3xl opacity-20 animate-bounce" style={{ animationDuration: '7s', animationDelay: '1s' }}>🌴</div>
        <div className="absolute top-[60%] left-[12%] text-3xl opacity-15 animate-bounce" style={{ animationDuration: '8s', animationDelay: '2s' }}>🐠</div>
        <div className="absolute bottom-[15%] right-[10%] text-4xl opacity-10 animate-bounce" style={{ animationDuration: '9s', animationDelay: '0.5s' }}>🏄</div>
      </div>

      <div className="container-main relative z-10 text-center text-white py-20">
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          {/* Logo Centered */}
          <div className="flex justify-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center p-3 shadow-2xl"
            >
              <Image src="/logo.png" alt="First Trip" width={56} height={56} className="w-full h-auto" priority />
            </motion.div>
          </div>

          {/* Hero Tagline */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="inline-block mb-6 px-5 py-2 rounded-full border border-white/30 bg-white/10 backdrop-blur text-sm tracking-widest uppercase"
          >
            {locale === 'ar' ? 'دهب · جنوب سيناء · مصر' : 'Dahab · South Sinai · Egypt'}
          </motion.div>

          {/* Main Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight mb-4 leading-[1.1]">
            <span className="block">{locale === 'ar' ? 'دهب مش مجرد رحلة' : "Dahab isn't just a trip"}</span>
            <span className="block mt-2 bg-gradient-to-r from-[#38BDF8] to-[#FB923C] bg-clip-text text-transparent">
              {locale === 'ar' ? 'دي First Trip بتاعتك' : "it's YOUR First Trip"}
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto mb-10 leading-relaxed font-light">
            {locale === 'ar'
              ? 'باقات شاملة — انتقالات، إقامة في أفضل الفنادق والشاليهات، ورحلات داخلية. كل حاجة متظبطة، وإنت بس تعيشها.'
              : 'All-inclusive packages — transfers, stays in the best hotels & chalets, and Sinai day trips. Everything sorted — you just live it.'}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonLink
              href="/book-dahab"
              size="xl"
              className="bg-brand-orange hover:bg-brand-orange-dark shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/40 transition-all hover:-translate-y-1"
            >
              {t('hero.cta')}
              {locale === 'ar' ? <ArrowLeft className="h-5 w-5 mr-2" /> : <ChevronRight className="h-5 w-5 ml-2" />}
            </ButtonLink>
            <a
              href={`https://wa.me/201005744083`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center h-14 px-10 rounded-full text-lg font-medium border-2 border-white/40 text-white hover:bg-white/10 hover:border-white/60 backdrop-blur transition-all"
            >
              <span className="mr-2">💬</span>
              {locale === 'ar' ? 'احجز عبر واتساب' : 'Book on WhatsApp'}
            </a>
          </div>

          {/* Scroll indicator */}
          <motion.div
            className="absolute bottom-8 left-1/2 -translate-x-1/2"
            animate={{ y: [0, 12, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="w-6 h-10 rounded-full border-2 border-white/40 flex items-start justify-center p-1">
              <div className="w-1.5 h-3 bg-white/60 rounded-full" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

/* ──────── Trust Bar ──────── */
function TrustBar() {
  return (
    <section className="bg-brand-blue py-8 text-white">
      <div className="container-main">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {TRUST_STATS.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="py-2"
            >
              <div className="text-3xl sm:text-4xl font-extrabold">{stat.value}</div>
              <div className="text-sm sm:text-base text-blue-100 mt-1">
                {stat.label_ar}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────── Services Section ──────── */
function ServicesSection({ t, locale }: Props) {
  return (
    <section className="section-padding bg-white">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t('home.servicesTitle')}
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            {locale === 'ar'
              ? 'نقدم لك 4 خدمات رئيسية تغطي كل احتياجات رحلتك لدهب'
              : 'We offer 4 main services covering all your Dahab trip needs'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {SERVICES.map((service, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
            >
              <Link href={service.href}>
                <Card className="group h-full hover:shadow-lg hover:border-brand-blue/30 transition-all duration-300 hover:-translate-y-1 cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                      {service.icon}
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {locale === 'ar' ? service.title_ar : service.title_en}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {locale === 'ar' ? service.description_ar : service.description_en}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────── Why First Trip ──────── */
function WhyUsSection({ t, locale }: Props) {
  return (
    <section className="section-padding bg-gray-50">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t('home.whyUsTitle')}
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_US.map((point, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="text-center p-6"
            >
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-blue/10 text-brand-blue mb-4">
                <span className="text-2xl">{point.icon}</span>
              </div>
              <h3 className="font-bold text-gray-900 mb-2">
                {locale === 'ar' ? point.title_ar : point.title_en}
              </h3>
              <p className="text-sm text-gray-500">
                {locale === 'ar' ? point.description_ar : point.description_en}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────── Testimonials ──────── */
function TestimonialsSection({ t, locale }: Props) {
  const [current, setCurrent] = useState(0)
  const len = TESTIMONIALS.length

  const next = useCallback(() => setCurrent((c) => (c + 1) % len), [len])
  const prev = useCallback(() => setCurrent((c) => (c - 1 + len) % len), [len])

  return (
    <section className="section-padding bg-white">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t('home.testimonialsTitle')}
          </h2>
        </motion.div>

        <div className="max-w-2xl mx-auto relative">
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="bg-gray-50 rounded-2xl p-8 md:p-10 text-center"
          >
            <div className="flex justify-center mb-4">
              {[...Array(TESTIMONIALS[current].rating)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <p className="text-gray-700 text-lg leading-relaxed mb-6">
              &ldquo;{locale === 'ar' ? TESTIMONIALS[current].text_ar : TESTIMONIALS[current].text_en}&rdquo;
            </p>
            <div className="font-bold text-gray-900">
              {TESTIMONIALS[current].name}
            </div>
          </motion.div>

          <div className="flex justify-center gap-4 mt-6">
            <Button variant="outline" size="icon" onClick={prev} className="rounded-full">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-1.5">
              {TESTIMONIALS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrent(i)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i === current ? 'bg-brand-blue w-4' : 'bg-gray-300'
                  )}
                />
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={next} className="rounded-full">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ──────── Dahab Quick Guide ──────── */
function DahabGuideSection({ t, locale }: Props) {
  const guides = locale === 'ar' ? [
    { title: 'أفضل وقت لزيارة دهب', desc: 'من أكتوبر لأبريل — الجو مثالي للأنشطة الخارجية والبحر.' },
    { title: 'أشهر الأماكن', desc: 'بلو هول، الوادي الملون، جزيرة فرعون، محمية أبو جالوم، لاجونا.' },
    { title: 'أنشطة سياحية', desc: 'غوص، سنوركل، سفاري، كامبينج، كايت سيرف، يوجا، تسلق جبال.' },
    { title: 'نصائح مهمة', desc: 'احجز بدري في المواسم، خد معاك كاش كفاية، sunscreen وطارد ناموس.' },
  ] : [
    { title: 'Best Time to Visit Dahab', desc: 'October to April — perfect weather for outdoor activities and the sea.' },
    { title: 'Top Attractions', desc: 'Blue Hole, Colored Canyon, Pharaoh\'s Island, Abu Galum, Laguna.' },
    { title: 'Activities', desc: 'Diving, snorkeling, safari, camping, kite surfing, yoga, mountain climbing.' },
    { title: 'Essential Tips', desc: 'Book early in peak seasons, carry enough cash, sunscreen & mosquito repellent.' },
  ]

  return (
    <section className="section-padding bg-gradient-to-br from-brand-blue/5 to-brand-orange/5">
      <div className="container-main">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            {t('home.dahabGuideTitle')}
          </h2>
          <p className="text-gray-500 text-lg">
            {locale === 'ar' ? 'كل ما تحتاج معرفته عن دهب قبل رحلتك' : 'Everything you need to know before your trip'}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {guides.map((item, i) => (
            <motion.div
              key={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              custom={i}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue font-bold mb-3">
                {i + 1}
              </div>
              <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-sm text-gray-500">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ──────── Final CTA ──────── */
function FinalCtaSection({ t, locale }: Props) {
  return (
    <section className="section-padding bg-gray-900 text-white text-center">
      <div className="container-main max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('home.finalCta')}
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            {t('home.finalCtaSub')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <ButtonLink
              href="/book-dahab"
              size="lg"
              className="bg-brand-orange hover:bg-brand-orange-dark"
            >
              {locale === 'ar' ? 'احجز دلوقتي' : 'Book Now'}
            </ButtonLink>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center h-12 px-10 rounded-full text-lg font-medium border border-green-500 text-green-400 hover:bg-green-500/10 transition-all"
            >
              💬 {t('home.whatsappBtn')}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  )
}