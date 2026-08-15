'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
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
      <TrustBar />
      <Services />
      <HowItWorks />
      <Accommodations items={featuredAccs} />
      <Trips items={featuredTrips} whatsapp={settings?.whatsapp_number} />
      <WhyUs />
      <Testimonials items={testimonials} />
      {settings?.show_community !== false && <Community posts={posts} />}
      <DahabGuide />
      <FinalCta settings={settings} />
    </div>
  )
}

/* ─────────────────────────── HERO ─────────────────────────── */

/**
 * WEEMAP cinematic hero — a scroll-driven day-to-night scene over a Sinai road.
 *
 * Implementation follows _weemap_reference/03_hero/HERO_MOTION_BLUEPRINT.md:
 * golden hour → dusk → night, stars + moon fade in, a vehicle moves down the
 * road and its headlights come on at night. Built with layered CSS gradients
 * and one passive scroll listener (no WebGL, no heavy dependencies), and it
 * degrades to a static dusk scene when the user prefers reduced motion.
 * If a hero photo/video is set in Site Settings it layers underneath.
 */
function useHeroProgress(ref: React.RefObject<HTMLElement | null>) {
  const [progress, setProgress] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from an external media query on mount
    setReduced(mq.matches)
    const onMq = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener?.('change', onMq)

    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        const total = rect.height - window.innerHeight
        if (total <= 0) { setProgress(0); return }
        const p = Math.min(1, Math.max(0, -rect.top / total))
        setProgress(p)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      mq.removeEventListener?.('change', onMq)
      cancelAnimationFrame(raf)
    }
  }, [ref])

  return { progress: reduced ? 0.55 : progress, reduced }
}

function Hero({ settings }: { settings: SiteSettings | null }) {
  const t = useTranslations()
  const locale = useLocale()
  const ar = locale === 'ar'
  const sectionRef = useRef<HTMLElement | null>(null)
  const { progress, reduced } = useHeroProgress(sectionRef)

  const media = settings?.hero_media_url || PLACEHOLDER_IMAGES.hero
  const isVideo = settings?.hero_type === 'video' && Boolean(settings?.hero_media_url)
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')

  // Owner-editable hero copy (Site Settings → Homepage). Empty = default.
  const headingAr = settings?.hero_heading_ar || 'إحنا بنرسم لك سيناء'
  const headingEn = settings?.hero_heading_en || 'We map Sinai.'
  const subAr = settings?.hero_subheading_ar || 'وإنت بتعيشها'
  const subEn = settings?.hero_subheading_en || 'You live it.'

  // Scene phases: 0 golden hour → 0.35 dusk → 0.7 blue hour → 1 night
  const dusk = Math.min(1, progress / 0.45)
  const night = Math.max(0, (progress - 0.45) / 0.55)
  const stars = Math.max(0, (progress - 0.5) / 0.5)
  const headlights = night > 0.5 ? Math.min(1, (night - 0.5) / 0.3) : 0
  // vehicle travels down the road as you scroll
  const carY = 18 + progress * 46 // vh from top of viewport
  const carScale = 0.5 + progress * 0.9

  return (
    <section
      ref={sectionRef}
      className="relative"
      style={{ height: reduced ? 'auto' : '220vh' }}
    >
      <div
        className={cn(
          'isolate flex min-h-[88vh] items-center overflow-hidden bg-sea-900 grain',
          reduced ? 'relative' : 'sticky top-0 h-screen',
        )}
      >
        <div className="absolute inset-0 -z-10">
          {isVideo ? (
            <video src={media} autoPlay muted loop playsInline className="h-full w-full object-cover opacity-40" />
          ) : (
            <Image src={media} alt="Sinai" fill priority sizes="100vw" className="object-cover opacity-40" />
          )}

          {/* ─── Sky: golden hour base ─── */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #2b3a55 0%, #7a5a48 45%, #e08b3c 78%, #f2b45c 100%)',
            opacity: 1 - dusk * 0.85,
          }} />
          {/* ─── Dusk layer ─── */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #101a2e 0%, #23304d 55%, #b06a45 88%, #d99553 100%)',
            opacity: dusk * (1 - night * 0.8),
          }} />
          {/* ─── Night layer ─── */}
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, #05080f 0%, #0a1220 60%, #17223a 100%)',
            opacity: night,
          }} />

          {/* ─── Stars (two parallax fields) ─── */}
          <div className="absolute inset-0" aria-hidden style={{
            opacity: stars,
            backgroundImage:
              'radial-gradient(1px 1px at 12% 18%, #fff 60%, transparent), radial-gradient(1px 1px at 34% 8%, #fff 55%, transparent), radial-gradient(1.5px 1.5px at 56% 24%, #fff 60%, transparent), radial-gradient(1px 1px at 72% 12%, #fff 50%, transparent), radial-gradient(1px 1px at 88% 30%, #fff 55%, transparent), radial-gradient(1px 1px at 22% 38%, #ffffffcc 55%, transparent), radial-gradient(1.5px 1.5px at 64% 40%, #ffffffbb 55%, transparent), radial-gradient(1px 1px at 44% 16%, #ffffffaa 50%, transparent)',
          }} />

          {/* ─── Subtle moon ─── */}
          <div className="absolute" aria-hidden style={{
            top: '10%', insetInlineEnd: '12%',
            width: 54, height: 54, borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 38%, #fdf6e3, #e8dcc0 65%, transparent 72%)',
            boxShadow: '0 0 40px 12px rgba(253, 246, 227, 0.25)',
            opacity: stars * 0.9,
            transform: `translateY(${(1 - stars) * 30}px)`,
          }} />

          {/* ─── Sinai ridge silhouettes ─── */}
          <svg aria-hidden className="absolute inset-x-0 bottom-0 h-[46%] w-full" viewBox="0 0 1440 400" preserveAspectRatio="none">
            <path d="M0 400 L0 220 L180 120 L320 200 L470 90 L640 210 L820 60 L1010 190 L1180 110 L1320 180 L1440 130 L1440 400 Z"
              fill="#0b1424" opacity={0.55 + night * 0.35} />
            <path d="M0 400 L0 300 L240 210 L420 280 L610 180 L840 290 L1040 200 L1250 280 L1440 230 L1440 400 Z"
              fill="#070d18" opacity={0.75 + night * 0.25} />
          </svg>

          {/* ─── Road ─── */}
          <svg aria-hidden className="absolute inset-x-0 bottom-0 h-[52%] w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <path d="M 48 0 C 52 30, 40 55, 46 100 L 58 100 C 50 55, 60 30, 52 0 Z" fill="#0e131c" opacity={0.9} />
            <path d="M 50 2 C 52.5 30, 44 55, 51.5 98" stroke="#d9a24a" strokeWidth="0.35" strokeDasharray="3 2.4" fill="none" opacity={0.5 + night * 0.3} />
          </svg>

          {/* ─── Vehicle + headlights ─── */}
          {!reduced && (
            <div aria-hidden className="absolute left-1/2" style={{
              top: `${carY}vh`,
              transform: `translateX(-50%) scale(${carScale})`,
              opacity: progress > 0.02 ? 1 : 0,
              transition: 'opacity 0.4s',
            }}>
              {/* headlight cones */}
              <div style={{
                position: 'absolute', top: 26, left: '50%', transform: 'translateX(-50%)',
                width: 120, height: 90, opacity: headlights,
                background: 'conic-gradient(from 155deg at 50% 0%, transparent 0deg, rgba(255,240,200,0.28) 22deg, rgba(255,240,200,0.28) 28deg, transparent 50deg)',
                filter: 'blur(2px)',
              }} />
              {/* the car — tiny top-view */}
              <div style={{
                width: 16, height: 30, borderRadius: 5,
                background: 'linear-gradient(to bottom, #e8e4da, #b9b4a8)',
                boxShadow: `0 2px 8px rgba(0,0,0,0.55)${headlights ? ', 0 -4px 14px rgba(255,236,190,0.5)' : ''}`,
                position: 'relative',
              }}>
                <div style={{ position: 'absolute', top: 5, left: 2.5, right: 2.5, height: 8, borderRadius: 2.5, background: '#2c3540' }} />
              </div>
            </div>
          )}

          {/* Sea-to-sand vertical wash — the identity in one gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/50 via-transparent to-sea-900/80" />
          <div className="absolute inset-0 depth-bg opacity-40" />
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
            <h1 className="font-display text-[2.6rem] font-bold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
              <span className="block">{ar ? headingAr : headingEn}</span>
              <span className="mt-2 block text-sun-300">{ar ? subAr : subEn}</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-sand-100/80 sm:text-lg">
              {ar
                ? 'انتقالات، إقامة في أماكن نزلنا فيها بنفسنا، ورحلتين داخليتين. إحنا بنظبط كل التفاصيل — وإنت بس تعيشها.'
                : 'Transportation, accommodation in places we\'ve tried and 2 domestic trips. We will sort out the details and you will just live it.'}
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

          {/* brand stamp — small human detail rather than another badge row.
              No founding-year claim: historical facts need verification first
              (see _weemap_reference/06_business-info/WEEMAP_INFO.md). */}
          <Reveal delay={320}>
            <div className="mt-12 inline-flex items-center gap-3 border-s-2 border-sun-400/70 ps-4">
              <Logo size="sm" variant="mark" />
              <p className="text-sm leading-snug text-sand-100/65">
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
      </div>
    </section>
  )
}

/* ─────────────────────────── TRUST BAR ─────────────────────────── */

function TrustBar() {
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="border-b border-sand-200 bg-card">
      <div className="container-main">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 py-8 md:grid-cols-4 md:gap-x-6 md:py-12">
          {TRUST_STATS.map((stat, i) => (
            <Reveal
              key={i}
              delay={i * 70}
              className="group flex items-start gap-3 rounded-2xl p-3 transition-colors hover:bg-sea-50 md:p-4"
            >
              <span
                aria-hidden
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sun-100 text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6 md:h-12 md:w-12"
              >
                {stat.icon}
              </span>
              <div className="min-w-0">
                <div className="font-display text-sm font-bold leading-tight text-sea-900 md:text-base">
                  {ar ? stat.label_ar : stat.label_en}
                </div>
                <div className="mt-1 text-xs leading-snug text-sea-900/55 md:text-[0.8rem]">
                  {ar ? stat.sub_ar : stat.sub_en}
                </div>
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
              : 'Four services that cover your trip from your door and back.'
          }
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((service, i) => (
            <Reveal key={i} delay={i * 80} className="h-full">
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
                  : 'Not the biggest company, but probably the most caring and detail-oriented.'
              }
              className="mb-0"
            />
          </div>

          <div className="grid gap-px overflow-hidden border-[1.5px] border-sand-300 bg-sand-300 pin-card sm:grid-cols-2">
            {WHY_US.map((point, i) => (
              <Reveal key={i} delay={i * 70} className="bg-card p-6 md:p-7">
                <span aria-hidden className="mb-4 block text-3xl">{point.icon}</span>
                <h3 className="font-display text-base font-semibold text-sea-900">
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
