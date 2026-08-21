'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ButtonLink } from '@/components/ButtonLink'
import { Logo } from '@/components/brand/Logo'
import { SectionHeading, WaveDivider, TopoBackdrop } from '@/components/brand/Section'
import { Reveal, GlowCard } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { TripCard } from '@/components/cards/TripCard'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { TrustSection } from '@/components/TrustSection'
import { SERVICES, WHATSAPP_NUMBER } from '@/lib/constants'
import { ArrowUpRight, MessageCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Accommodation, CommunityPost, SinaiTrip, SiteSettings,
} from '@/lib/types'

interface Props {
  accommodations: Accommodation[]
  trips: SinaiTrip[]
  posts: CommunityPost[]
  settings: SiteSettings | null
}

export function HomeClient({ accommodations, trips, posts, settings }: Props) {
  // Owner-picked featured content (Site Settings → Homepage); empty = automatic
  const featuredAccIds = settings?.featured_accommodation_ids || []
  const featuredTripIds = settings?.featured_trip_ids || []
  const featuredAccs = featuredAccIds.length
    ? accommodations.filter(a => featuredAccIds.includes(a.id))
    : accommodations
  const featuredTrips = featuredTripIds.length
    ? trips.filter(t => featuredTripIds.includes(t.id))
    : trips

  return (
    <div className="overflow-x-clip">
      <Hero settings={settings} />
      <Services />
      <Trips items={featuredTrips} />
      <Accommodations items={featuredAccs} />
      <ExploreSinai trip={featuredTrips[0]} settings={settings} />
      <WeemapPicks accommodation={featuredAccs[0]} trip={featuredTrips[1] || featuredTrips[0]} />
      <HowItWorks />
      <TrustSection />
      {settings?.show_community !== false && <Community posts={posts} />}
      {settings?.show_partners !== false && <Partners />}
      <DahabGuide />
      {settings?.show_newsletter !== false && <NewsletterSignup />}
      <FinalCta settings={settings} />
    </div>
  )
}

/* ─────────────────────────── HERO ─────────────────────────── */

/**
 * WEEMAP video-first hero.
 *
 * Full-viewport cinematic video (the approved final plate — see
 * `_weemap_reference/03_hero`) — autoplay, muted, loop, playsInline, a
 * poster fallback, and a single readability overlay. Every bit of motion
 * (the road, the light, the vehicle) already lives inside the video itself,
 * so there is deliberately no scroll-driven choreography, parallax layers,
 * or canvas/WebGL here. `prefers-reduced-motion` swaps the video for the
 * static poster frame.
 */
function Hero({ settings }: { settings: SiteSettings | null }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const videoSrc = '/media/herovideo.mp4'
  const posterSrc = '/media/heroposter.png'

  /**
   * Mobile hero fix: the video element starts opacity-0 so the poster is
   * always visible. We reveal the video only when it is ACTUALLY playing —
   * which prevents the black frame that appears on iOS/Android when the
   * browser loads the video element but hasn't started rendering frames yet.
   *
   * Using both `onCanPlay` (fires early on desktop) and `onPlay` (fires when
   * the browser starts frame-delivery) for widest compatibility.
   * `prefers-reduced-motion` keeps the video hidden entirely.
   */
  const [videoReady, setVideoReady] = useState(false)
  const revealVideo = () => setVideoReady(true)

  // Owner-editable hero copy (Site Settings → Homepage). Empty = default.
  const headingAr = settings?.hero_heading_ar || 'إحنا بنرسم لك سيناء'
  const headingEn = settings?.hero_heading_en || 'We map Sinai.'
  const subAr = settings?.hero_subheading_ar || 'وإنت بتعيشها'
  const subEn = settings?.hero_subheading_en || 'You live it.'

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden bg-sea-900">
      <div className="absolute inset-0 -z-10">
        {/* Poster — ALWAYS rendered, NEVER removed. It is the background
            fallback for when autoplay fails or prefers-reduced-motion is on. */}
        <Image
          src={posterSrc}
          alt={ar ? 'طريق صحراوي في سيناء ليلاً' : 'A Sinai desert road at night'}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {/* Video: starts completely invisible (opacity-0). Fades in only
            when the browser confirms it is actually delivering frames.
            The poster image above acts as the persistent fallback layer. */}
        <video
          key={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden
          onCanPlay={revealVideo}
          onPlay={revealVideo}
          className={cn(
            'absolute inset-0 h-full w-full object-cover motion-reduce:hidden',
            'transition-opacity duration-700',
            videoReady ? 'opacity-100' : 'opacity-0',
          )}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>

        {/* Readability overlay only — all motion already lives in the video. */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="container-main relative z-10 py-28 md:py-32">
        <div className="max-w-2xl">
          <Reveal>
            <span className="eyebrow mb-6 text-sun-300">
              <span aria-hidden className="h-px w-8 bg-current" />
              {ar ? 'دهب · جنوب سيناء · مصر' : 'Dahab · South Sinai · Egypt'}
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="font-display text-[2.6rem] font-bold uppercase leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl">
              <span className="block">{ar ? headingAr : headingEn}</span>
              <span className="mt-2 block text-sun-300">{ar ? subAr : subEn}</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-sand-100/85 sm:text-lg">
              {ar
                ? 'انتقالات، إقامة، ورحلات سينا في مكان واحد. اختار اللي يناسب رحلتك وإحنا نأكد معاك التفاصيل.'
                : 'Transfers, stays, and Sinai trips in one place. Choose what fits and we will confirm the details with you.'}
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
                {(ar ? settings?.primary_cta_label_ar : settings?.primary_cta_label_en) || (ar ? 'خطط رحلتك' : 'PLAN YOUR TRIP')}
                <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
              </ButtonLink>

              <ButtonLink
                href="/sinai-trips"
                size="xl"
                variant="outline-light"
                className="justify-center backdrop-blur"
              >
                {(ar ? settings?.secondary_cta_label_ar : settings?.secondary_cta_label_en) || (ar ? 'استكشف سيناء' : 'EXPLORE SINAI')}
              </ButtonLink>
            </div>
          </Reveal>

          {/* brand stamp — small human detail rather than another badge row.
              No founding-year claim: historical facts need verification first
              (see _weemap_reference/06_business-info/WEEMAP_INFO.md). */}
          <Reveal delay={320}>
            <div className="mt-12 inline-flex items-center gap-3 border-s-2 border-sun-400/70 ps-4">
              <Logo size="sm" variant="mark" tone="light" />
              <p className="text-sm leading-snug text-sand-100/70">
                {ar ? (
                  <>من قلب <strong className="font-semibold text-white">دهب، جنوب سيناء</strong></>
                ) : (
                  <>From the heart of <strong className="font-semibold text-white">Dahab, South Sinai</strong></>
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
              ? 'ابدأ باللي محتاجه: باكدج كامل، إقامة، رحلة، أو انتقال.'
              : 'Start with what you need: a full package, stay, trip, or transfer.'
          }
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
          {SERVICES.map((service, i) => (
            <Reveal key={i} delay={i * 80} className={cn('h-full', i < 2 ? 'lg:col-span-6' : i === 2 ? 'lg:col-span-5' : 'lg:col-span-7')}>
              <GlowCard className="h-full">
                <Link
                  href={service.href}
                  className="hover-lift group flex h-full flex-col border-[1.5px] border-sand-300 bg-card p-6 pin-card transition-colors hover:border-sea-900/25"
                >
                  <span
                    aria-hidden
                    className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-100 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]"
                  >
                    {service.icon}
                  </span>
                  <h3 className="font-display text-lg font-semibold text-sea-900">
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
              <h3 className="font-display text-lg font-semibold text-white">{step.title}</h3>
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

function Trips({ items }: { items: SinaiTrip[] }) {
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
              <TripCard trip={trip} />
            </Reveal>
          ))}
        </ScrollRail>
      </div>
    </section>
  )
}

/* ─────────────────────────── WHY US ─────────────────────────── */

function ExploreSinai({ trip, settings }: { trip?: SinaiTrip; settings: SiteSettings | null }) {
  const t = useTranslations('home')
  const locale = useLocale()
  const ar = locale === 'ar'
  const image = settings?.explore_media_url || trip?.images?.[0] || '/media/heroposter.png'
  const alt = (ar ? settings?.explore_media_alt_ar : settings?.explore_media_alt_en) || t('exploreMediaAlt')
  const copy = (ar ? settings?.explore_copy_ar : settings?.explore_copy_en) || t('exploreCopy')
  return (
    <section className="relative isolate min-h-[32rem] overflow-hidden bg-sea-900 text-white md:min-h-[40rem]">
      <Image src={image} alt={alt} fill sizes="100vw" className="-z-20 object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/35 to-black/5 rtl:bg-gradient-to-l" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      <div className="container-main flex min-h-[32rem] items-end py-14 md:min-h-[40rem] md:items-center md:py-24">
        <Reveal className="max-w-2xl">
          <span className="eyebrow text-sun-300">{t('exploreEyebrow')}</span>
          <h2 className="mt-5 max-w-xl text-4xl font-extrabold leading-[1.04] sm:text-5xl md:text-7xl">
            {t('exploreTitle')}
          </h2>
          <p className="mt-6 line-clamp-4 max-w-[36rem] text-base leading-relaxed text-white/85 sm:line-clamp-3 sm:text-lg">
            {copy}
          </p>
          <ButtonLink href="/sinai-trips" variant="sun" size="lg" className="mt-8">
            {t('exploreCta')}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}

function WeemapPicks({ accommodation, trip }: { accommodation?: Accommodation; trip?: SinaiTrip }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  if (!accommodation && !trip) return null
  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <SectionHeading
          eyebrow={ar ? 'اختيارات وي ماب' : 'WEEMAP Picks'}
          title={ar ? 'نقط بداية لرحلة أحلى' : 'A considered place to start'}
          subtitle={ar ? 'اختيارات من الإقامة والرحلات المميزة الموجودة دلوقتي.' : 'A focused edit from the stays and trips currently available.'}
        />
        <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
          {accommodation && <div className="lg:col-span-7"><AccommodationCard acc={accommodation} /></div>}
          {trip && <div className="lg:col-span-5"><TripCard trip={trip} /></div>}
        </div>
      </div>
    </section>
  )
}

function Partners() {
  const locale = useLocale()
  const ar = locale === 'ar'
  return (
    <section className="border-y border-white/10 bg-[#1b1b17] py-16 text-sand-50 md:py-20">
      <div className="container-main grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
        <Reveal>
          <span className="eyebrow text-sun-300">{ar ? 'شركاء الرحلة' : 'Partners in the journey'}</span>
          <h2 className="mt-4 max-w-3xl text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            {ar ? 'بنبني الرحلة مع الناس اللي عايشة سينا.' : 'The strongest Sinai journeys are built locally.'}
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-sand-100/70">
            {ar ? 'لو بتدير مكان إقامة أو تجربة أو خدمة نقل، نحب نسمع منك.' : 'If you run a stay, experience, or transport service, we would like to hear from you.'}
          </p>
        </Reveal>
        <Reveal delay={80} className="md:text-end">
          <ButtonLink href="/partner" variant="outline-light" size="lg">
            {ar ? 'اشتغل مع وي ماب' : 'Work with WEEMAP'}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </ButtonLink>
        </Reveal>
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
                className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card"
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
                  <h3 className="font-display text-base font-semibold leading-snug text-sea-900">
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
        { title: 'الجو في دهب', desc: 'دافي طول السنة — بس أمتع وقت بين أكتوبر وأبريل. الصيف حار بس البحر بيكسبها.' },
        { title: 'اللي هتشوفه', desc: 'بلو هول، الوادي الملون، أبو جالوم، لاجونا، جزيرة فرعون — كل ناحية فيها حاجة.' },
        { title: 'اللي هتعمله', desc: 'سنوركل، غوص، سفاري جبلية، كايت سيرف، كامبينج، يوجا على الشاطئ.' },
        { title: 'خد بالك', desc: 'كاش مهم — ATM مش دايماً موجود. جيب صن بلوك ومواسم الموجة احجز بدري.' },
      ]
    : [
        { title: 'Weather', desc: 'Warm year-round — October to April is the sweet spot. Summer is hot, but the sea makes up for it.' },
        { title: 'What you\'ll see', desc: 'Blue Hole, Colored Canyon, Abu Galum, Lagona, Pharaoh\'s Island — every corner has something.' },
        { title: 'What you\'ll do', desc: 'Snorkelling, diving, mountain safari, kitesurfing, camping, beach yoga.' },
        { title: 'Good to know', desc: 'Bring cash — ATMs aren\'t always around. Sunscreen is a must. Book early in peak season.' },
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
              <div className="hover-lift h-full border-[1.5px] border-sand-300 bg-card p-6 pin-card">
                <span className="font-display text-4xl font-extrabold text-sand-300">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-base font-semibold text-sea-900">
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
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
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
