'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ButtonLink } from '@/components/ButtonLink'
import { Logo } from '@/components/brand/Logo'
import { SectionHeading, WaveDivider, TopoBackdrop } from '@/components/brand/Section'
import { Reveal, GlowCard } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { TripCard } from '@/components/cards/TripCard'
import {
  SERVICES, WHY_US, TRUST_STATS, WHATSAPP_NUMBER, PLACEHOLDER_IMAGES,
} from '@/lib/constants'
import { Star, ArrowUpRight, Quote, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Accommodation, CommunityPost, SinaiTrip, SiteSettings, Testimonial,
} from '@/lib/types'

interface Props {
  accommodations: Accommodation[]
  trips: SinaiTrip[]
  posts: CommunityPost[]
  testimonials: Testimonial[]
  settings: SiteSettings | null
}

export function HomeClient({ accommodations, trips, posts, testimonials, settings }: Props) {
  return (
    <div className="overflow-x-clip">
      <Hero settings={settings} />
      <TrustBar />
      <Services />
      <HowItWorks />
      <Accommodations items={accommodations} />
      <Trips items={trips} whatsapp={settings?.whatsapp_number} />
      <WhyUs />
      <Testimonials items={testimonials} />
      <Community posts={posts} />
      <DahabGuide />
      <FinalCta settings={settings} />
    </div>
  )
}

/* ─────────────────────────── HERO ─────────────────────────── */

function Hero({ settings }: { settings: SiteSettings | null }) {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'

  const media = settings?.hero_media_url || PLACEHOLDER_IMAGES.hero
  const isVideo = settings?.hero_type === 'video' && Boolean(settings?.hero_media_url)
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')

  return (
    <section className="relative isolate flex min-h-[88vh] items-center overflow-hidden bg-sea-900 grain">
      <div className="absolute inset-0 -z-10">
        {isVideo ? (
          <video
            src={media}
            autoPlay
            muted
            loop
            playsInline
            className="h-full w-full object-cover opacity-55"
          />
        ) : (
          <Image
            src={media}
            alt="Dahab"
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-55"
          />
        )}
        {/* Sea-to-sand vertical wash — the identity in one gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-sea-900/85 via-sea-900/55 to-sea-900/95" />
        <div className="absolute inset-0 depth-bg opacity-60" />
      </div>

      <div className="container-main relative z-10 py-24 md:py-28">
        <div className="max-w-3xl">
          <Reveal>
            <span className="eyebrow mb-6 text-sun-300">
              <span aria-hidden className="h-px w-8 bg-current" />
              {ar ? 'دهب · جنوب سيناء · مصر' : 'Dahab · South Sinai · Egypt'}
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              {ar ? (
                <>
                  <span className="block">دهب مش مجرد رحلة</span>
                  <span className="mt-2 block text-sun-300">دي First Trip بتاعتك</span>
                </>
              ) : (
                <>
                  <span className="block">Dahab isn&rsquo;t just a trip</span>
                  <span className="mt-2 block text-sun-300">it&rsquo;s your First Trip</span>
                </>
              )}
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-sand-100/80 sm:text-lg">
              {ar
                ? 'انتقالات، إقامة في أماكن نزلنا فيها بنفسنا، ورحلتين داخليتين. إحنا بنظبط كل التفاصيل — وإنت بس تعيشها.'
                : 'Transfers, a stay in places we\'ve slept in ourselves, and two day trips. We sort every detail — you just live it.'}
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href="/book-dahab"
                size="xl"
                variant="sun"
                className="group justify-center"
              >
                {t('hero.cta')}
                <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
              </ButtonLink>

              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noopener"
                className="inline-flex h-14 items-center justify-center gap-2 rounded-full border-[1.5px] border-white/40 px-8 text-base font-medium text-white backdrop-blur transition-all hover:border-white/70 hover:bg-white/10"
              >
                <MessageCircle className="h-5 w-5" />
                {ar ? 'كلمنا على واتساب' : 'Chat on WhatsApp'}
              </a>
            </div>
          </Reveal>

          {/* "since 2017" stamp — small human detail rather than another badge row */}
          <Reveal delay={320}>
            <div className="mt-12 inline-flex items-center gap-3 border-s-2 border-sun-400/70 ps-4">
              <Logo size="sm" variant="mark" />
              <p className="text-sm leading-snug text-sand-100/65">
                {ar ? (
                  <>بننظم رحلات لدهب من <strong className="font-semibold text-white">2017</strong></>
                ) : (
                  <>Organising trips to Dahab since <strong className="font-semibold text-white">2017</strong></>
                )}
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <WaveDivider className="absolute inset-x-0 bottom-0 z-10 text-sand-50" />
    </section>
  )
}

/* ─────────────────────────── TRUST BAR ─────────────────────────── */

function TrustBar() {
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="border-b border-sand-300 bg-sand-50">
      <div className="container-main">
        <div className="grid grid-cols-2 divide-sand-300 md:grid-cols-4 md:divide-x md:rtl:divide-x-reverse">
          {TRUST_STATS.map((stat, i) => (
            <Reveal
              key={i}
              delay={i * 70}
              className={cn(
                'px-4 py-8 text-center md:py-10',
                i < 2 && 'border-b border-sand-300 md:border-b-0',
                i % 2 === 0 && 'border-e border-sand-300 md:border-e-0',
              )}
            >
              <div className="font-display text-3xl font-extrabold text-sea-900 sm:text-4xl">
                {stat.value}
              </div>
              <div className="mt-1.5 text-xs font-medium uppercase tracking-wider text-sea-900/50 sm:text-sm sm:normal-case sm:tracking-normal">
                {ar ? stat.label_ar : stat.label_en}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── SERVICES ─────────────────────────── */

function Services() {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="relative section-padding bg-sand-50">
      <TopoBackdrop />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'خدماتنا' : 'What we do'}
          title={t('home.servicesTitle')}
          subtitle={
            ar
              ? 'أربع خدمات تغطي رحلتك من باب بيتك لحد ما ترجع.'
              : 'Four services that cover your trip from your front door and back.'
          }
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, i) => (
            <Reveal key={i} delay={i * 80} className="h-full">
              <GlowCard className="h-full">
                <Link
                  href={service.href}
                  className="hover-lift group flex h-full flex-col border-[1.5px] border-sand-300 bg-white p-6 pin-card transition-colors hover:border-sea-900/25"
                >
                  <span
                    aria-hidden
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                  >
                    {service.icon}
                  </span>
                  <h3 className="font-display text-lg font-bold text-sea-900">
                    {ar ? service.title_ar : service.title_en}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-sea-900/60">
                    {ar ? service.description_ar : service.description_en}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-sea-600 transition-colors group-hover:text-sun-500">
                    {ar ? 'اعرف أكتر' : 'Learn more'}
                    <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                  </span>
                </Link>
              </GlowCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── HOW IT WORKS ─────────────────────────── */

function HowItWorks() {
  const t = useTranslations('home')

  const steps = [
    { title: t('step1'), desc: t('step1Desc') },
    { title: t('step2'), desc: t('step2Desc') },
    { title: t('step3'), desc: t('step3Desc') },
    { title: t('step4'), desc: t('step4Desc') },
  ]

  return (
    <section className="relative overflow-hidden bg-sea-900 py-20 text-white md:py-28">
      <div className="absolute inset-0 depth-bg opacity-70" />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={t('howItWorksTitle')}
          title={t('howItWorksTitle')}
          subtitle={t('howItWorksSub')}
          tone="light"
        />

        <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
          {/* the dotted route line that ties the four steps together */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-6 hidden border-t-2 border-dashed border-white/15 md:block"
          />
          {steps.map((step, i) => (
            <Reveal key={i} delay={i * 90} as="li" className="relative">
              <div className="relative mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-sun-400 bg-sea-900 font-display text-lg font-extrabold text-sun-300">
                {i + 1}
              </div>
              <h3 className="font-display text-lg font-bold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-sand-100/65">{step.desc}</p>
            </Reveal>
          ))}
        </ol>
      </div>
      <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
    </section>
  )
}

/* ─────────────────────────── ACCOMMODATIONS ─────────────────────────── */

function Accommodations({ items }: { items: Accommodation[] }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = items.slice(0, 4)

  if (picks.length === 0) return null

  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <SectionHeading
          eyebrow={ar ? 'الإقامة' : 'Stays'}
          title={t('accommodationsTitle')}
          subtitle={t('accommodationsSub')}
          action={
            <ButtonLink href="/book-dahab" variant="outline-ink" size="lg">
              {t('viewAll')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
          }
        />

        <ScrollRail>
          {picks.map((acc, i) => (
            <Reveal key={acc.id} delay={i * 80} className="w-[78vw] shrink-0 sm:w-auto">
              <AccommodationCard acc={acc} priority={i === 0} />
            </Reveal>
          ))}
        </ScrollRail>
      </div>
    </section>
  )
}

/* ─────────────────────────── SINAI TRIPS ─────────────────────────── */

function Trips({ items, whatsapp }: { items: SinaiTrip[]; whatsapp?: string | null }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = items.slice(0, 3)

  if (picks.length === 0) return null

  return (
    <section className="relative section-padding bg-sand-100">
      <TopoBackdrop />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'رحلات داخلية' : 'Day trips'}
          title={t('tripsTitle')}
          subtitle={t('tripsSub')}
          action={
            <ButtonLink href="/sinai-trips" variant="outline-ink" size="lg">
              {t('viewAll')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
          }
        />

        <ScrollRail cols={3}>
          {picks.map((trip, i) => (
            <Reveal key={trip.id} delay={i * 80} className="w-[78vw] shrink-0 sm:w-auto">
              <TripCard trip={trip} whatsapp={whatsapp} />
            </Reveal>
          ))}
        </ScrollRail>
      </div>
    </section>
  )
}

/* ─────────────────────────── WHY US ─────────────────────────── */

function WhyUs() {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <SectionHeading
              eyebrow={ar ? 'ليه إحنا' : 'Why us'}
              title={t('home.whyUsTitle')}
              subtitle={
                ar
                  ? 'مش أكبر شركة، بس على الأرجح أكترهم اهتمامًا بالتفاصيل الصغيرة.'
                  : 'Not the biggest company — probably the one that sweats the small details most.'
              }
              className="mb-0"
            />
          </div>

          <div className="grid gap-px overflow-hidden border-[1.5px] border-sand-300 bg-sand-300 pin-card sm:grid-cols-2">
            {WHY_US.map((point, i) => (
              <Reveal key={i} delay={i * 70} className="bg-white p-6 md:p-7">
                <span aria-hidden className="mb-4 block text-3xl">{point.icon}</span>
                <h3 className="font-display text-base font-bold text-sea-900">
                  {ar ? point.title_ar : point.title_en}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-sea-900/60">
                  {ar ? point.description_ar : point.description_en}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── TESTIMONIALS ─────────────────────────── */

function Testimonials({ items }: { items: Testimonial[] }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [index, setIndex] = useState(0)

  const len = items.length
  const next = useCallback(() => setIndex((c) => (c + 1) % len), [len])
  const prev = useCallback(() => setIndex((c) => (c - 1 + len) % len), [len])

  if (len === 0) return null
  // Math.min guards against `index` briefly pointing past the end if the
  // testimonial list shrinks between renders (admin edits while a visitor is
  // browsing) — no effect needed, this is just render-time clamping.
  const current = items[Math.min(index, len - 1)]

  return (
    <section className="relative overflow-hidden bg-sea-800 py-20 text-white md:py-28">
      <div className="absolute inset-0 depth-bg opacity-60" />

      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'آراء' : 'Reviews'}
          title={t('testimonialsTitle')}
          subtitle={t('testimonialsSub')}
          tone="light"
        />

        <Reveal>
          <figure className="relative mx-auto max-w-3xl border-[1.5px] border-white/15 bg-white/[0.06] p-8 pin-card backdrop-blur-sm md:p-12">
            <Quote
              aria-hidden
              className="absolute -top-5 start-8 h-12 w-12 fill-sun-400 text-sun-400 rtl:-scale-x-100"
            />

            <div className="mb-5 flex gap-1">
              {Array.from({ length: current.rating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-sun-300 text-sun-300" />
              ))}
            </div>

            <blockquote
              key={current.id}
              className="text-lg leading-relaxed text-white/90 md:text-xl"
            >
              {ar ? current.text_ar || current.text_en : current.text_en || current.text_ar}
            </blockquote>

            <figcaption className="mt-7 flex items-center gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-sun-400 font-display text-base font-bold text-white">
                {current.name.trim().charAt(0)}
              </span>
              <span>
                <span className="block font-semibold text-white">{current.name}</span>
                {(current.trip_ar || current.trip_en) && (
                  <span className="block text-xs text-sand-100/60">
                    {ar
                      ? current.trip_ar || current.trip_en
                      : current.trip_en || current.trip_ar}
                  </span>
                )}
              </span>
            </figcaption>
          </figure>
        </Reveal>

        {len > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              onClick={prev}
              aria-label={ar ? 'السابق' : 'Previous'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
            >
              <ChevronLeft className="h-5 w-5 rtl:-scale-x-100" />
            </button>

            <div className="flex items-center gap-1.5">
              {items.map((item, i) => (
                <button
                  key={item.id}
                  onClick={() => setIndex(i)}
                  aria-label={`${i + 1}`}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    i === index ? 'w-6 bg-sun-400' : 'w-2 bg-white/30 hover:bg-white/50',
                  )}
                />
              ))}
            </div>

            <button
              onClick={next}
              aria-label={ar ? 'التالي' : 'Next'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white transition-colors hover:bg-white/10"
            >
              <ChevronRight className="h-5 w-5 rtl:-scale-x-100" />
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────── COMMUNITY ─────────────────────────── */

function Community({ posts }: { posts: CommunityPost[] }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = posts.slice(0, 3)

  if (picks.length === 0) return null

  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <SectionHeading
          eyebrow={ar ? 'المجتمع' : 'Community'}
          title={t('communityTitle')}
          subtitle={t('communitySub')}
          action={
            <ButtonLink href="/community" variant="outline-ink" size="lg">
              {t('viewAll')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
          }
        />

        <div className="grid gap-5 md:grid-cols-3">
          {picks.map((post, i) => (
            <Reveal key={post.id} delay={i * 80} className="h-full">
              <Link
                href="/community"
                className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-white pin-card"
              >
                {post.image_url && (
                  <div className="relative aspect-[16/10] overflow-hidden">
                    <Image
                      src={post.image_url}
                      alt={ar ? post.title_ar : post.title_en}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-display text-base font-bold leading-snug text-sea-900">
                    {ar ? post.title_ar : post.title_en}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-sea-900/60">
                    {ar ? post.content_ar : post.content_en}
                  </p>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-sea-600 transition-colors group-hover:text-sun-500">
                    {ar ? 'اقرأ المزيد' : 'Read more'}
                    <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── DAHAB GUIDE ─────────────────────────── */

function DahabGuide() {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'

  const guides = ar
    ? [
        { title: 'أفضل وقت للزيارة', desc: 'من أكتوبر لأبريل — الجو مثالي للبحر والأنشطة الخارجية.' },
        { title: 'أشهر الأماكن', desc: 'بلو هول، الوادي الملون، جزيرة فرعون، أبو جالوم، لاجونا.' },
        { title: 'الأنشطة', desc: 'غوص، سنوركل، سفاري، كامبينج، كايت سيرف، يوجا، تسلق.' },
        { title: 'نصايح مهمة', desc: 'احجز بدري في المواسم، خد كاش كفاية، وصن بلوك وطارد ناموس.' },
      ]
    : [
        { title: 'Best time to visit', desc: 'October to April — ideal weather for the sea and everything outdoors.' },
        { title: 'Top spots', desc: 'Blue Hole, Colored Canyon, Pharaoh\'s Island, Abu Galum, Laguna.' },
        { title: 'Things to do', desc: 'Diving, snorkelling, safari, camping, kitesurfing, yoga, climbing.' },
        { title: 'Practical tips', desc: 'Book early in season, bring enough cash, sunscreen and mosquito repellent.' },
      ]

  return (
    <section className="relative section-padding bg-sand-100">
      <TopoBackdrop />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'قبل ما تسافر' : 'Before you go'}
          title={t('home.dahabGuideTitle')}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {guides.map((item, i) => (
            <Reveal key={i} delay={i * 70} className="h-full">
              <div className="hover-lift h-full border-[1.5px] border-sand-300 bg-white p-6 pin-card">
                <span className="font-display text-4xl font-extrabold text-sand-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-base font-bold text-sea-900">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-sea-900/60">{item.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── FINAL CTA ─────────────────────────── */

function FinalCta({ settings }: { settings: SiteSettings | null }) {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')

  return (
    <section className="relative overflow-hidden bg-sun-400 py-20 text-white md:py-28 grain">
      <div
        aria-hidden
        className="absolute -end-24 -top-24 h-80 w-80 rounded-full border-[3rem] border-white/10"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -start-16 h-72 w-72 rounded-full border-[2.5rem] border-white/10"
      />

      <div className="container-main relative text-center">
        <Reveal>
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-extrabold leading-tight sm:text-4xl md:text-5xl">
            {t('home.finalCta')}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {t('home.finalCtaSub')}
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/book-dahab" size="lg" variant="ink" className="h-13 px-8">
              {ar ? 'احجز دلوقتي' : 'Book now'}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-white/60 px-8 text-base font-medium text-white transition-all hover:bg-white/15"
            >
              <MessageCircle className="h-5 w-5" />
              {t('home.whatsappBtn')}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─────────────────────────── shared ─────────────────────────── */

/**
 * Snap-scrolling rail on phones, plain grid from `sm` up. Card carousels that
 * stay as a cramped 1-column grid on mobile are the usual failure mode here.
 */
function ScrollRail({
  children,
  cols = 4,
}: {
  children: React.ReactNode
  cols?: 3 | 4
}) {
  return (
    <div
      className={cn(
        'no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 [&>*]:snap-start',
        cols === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3',
      )}
    >
      {children}
    </div>
  )
}
