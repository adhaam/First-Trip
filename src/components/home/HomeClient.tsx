'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ButtonLink } from '@/components/ButtonLink'
import { Logo } from '@/components/brand/Logo'
import { SectionHeading, WaveDivider, TopoBackdrop } from '@/components/brand/Section'
import { Reveal, GlowCard } from '@/components/motion/Reveal'
import { AccommodationCard } from '@/components/cards/AccommodationCard'
import { TripCard } from '@/components/cards/TripCard'
import { TripPackageCard } from '@/components/cards/TripPackageCard'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { TrustSection } from '@/components/TrustSection'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { ArrowUpRight, MessageCircle, Building2, Mountain, Package, Sparkles, ShoppingBag, Bike } from 'lucide-react'
import { cn } from '@/lib/utils'
import type {
  Accommodation, CommunityPost, SinaiTrip, SiteSettings, TripPackage,
} from '@/lib/types'

interface Props {
  accommodations: Accommodation[]
  trips: SinaiTrip[]
  posts: CommunityPost[]
  settings: SiteSettings | null
  packages: TripPackage[]
}

export function HomeClient({ accommodations, trips, posts, settings, packages }: Props) {
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
      <PrimaryDiscovery />
      <TripsAndPackages trips={featuredTrips} packages={packages} />
      <Stays items={featuredAccs} />
      <ExploreSinai trip={featuredTrips[0]} settings={settings} />
      <MoreFromWeemap />
      <SignatureFeature />
      <TrustSection />
      {settings?.show_partners !== false && <Partners />}
      {settings?.show_community !== false && <Community posts={posts} />}
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

  const [videoReady, setVideoReady] = useState(false)
  const revealVideo = () => setVideoReady(true)

  // Owner-editable hero copy (Site Settings → Homepage). Empty = brand default.
  const headingAr = settings?.hero_heading_ar || 'إحنا بنرسم لك سيناء'
  const headingEn = settings?.hero_heading_en || 'We map Sinai.'
  const subAr = settings?.hero_subheading_ar || 'وإنت بتعيشها'
  const subEn = settings?.hero_subheading_en || 'You live it.'

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden bg-sea-900">
      <div className="absolute inset-0 -z-10">
        <Image
          src={posterSrc}
          alt={ar ? 'طريق صحراوي في سيناء ليلاً' : 'A Sinai desert road at night'}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

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
                ? 'إقامة، انتقالات، رحلات، باقات وتجارب متظبطة في مكان واحد. اختار شكل رحلتك وإحنا نكمّل معاك التفاصيل.'
                : "Stays, transfers, trips, packages and curated experiences in one place. Choose how you want to experience Sinai and we'll help shape the rest."}
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
                {(ar ? settings?.primary_cta_label_ar : settings?.primary_cta_label_en) || (ar ? 'ابدأ رحلتك' : 'Start your trip')}
                <ArrowUpRight className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 rtl:-scale-x-100" />
              </ButtonLink>

              <ButtonLink
                href="/sinai-trips"
                size="xl"
                variant="outline-light"
                className="justify-center backdrop-blur"
              >
                {(ar ? settings?.secondary_cta_label_ar : settings?.secondary_cta_label_en) || (ar ? 'اكتشف سيناء' : 'Explore Sinai')}
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

function ExploreSinai({ trip, settings }: { trip?: SinaiTrip; settings: SiteSettings | null }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const image = settings?.explore_media_url || trip?.images?.[0] || '/media/heroposter.png'
  const alt = (ar ? settings?.explore_media_alt_ar : settings?.explore_media_alt_en)
    || (ar ? 'طبيعة سيناء' : 'The landscape of Sinai')
  const copy = (ar ? settings?.explore_copy_ar : settings?.explore_copy_en)
    || (ar
      ? 'من البحر للصحرا، ومن الهدوء للمغامرة — سيناء فيها مكان لكل شكل رحلة.'
      : 'From sea to desert, stillness to adventure — Sinai has room for every kind of journey.')

  return (
    <section className="relative isolate min-h-[34rem] overflow-hidden bg-sea-900 text-white md:min-h-[44rem]">
      <Image src={image} alt={alt} fill sizes="100vw" className="-z-20 object-cover object-center" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/30 to-transparent rtl:bg-gradient-to-l" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      <div className="container-main flex min-h-[34rem] items-end py-16 md:min-h-[44rem] md:items-center md:py-28">
        <Reveal className="max-w-2xl">
          <span className="eyebrow text-sun-300">{ar ? 'بين البحر والجبل' : 'Sea, mountains and everything between'}</span>
          <h2 className="mt-5 max-w-xl font-display text-4xl font-extrabold leading-[1.04] sm:text-5xl md:text-7xl">
            {ar ? 'سيناء أكتر من مجرد مكان.' : 'Sinai is more than a place.'}
          </h2>
          <p className="mt-6 max-w-[36rem] text-base leading-relaxed text-white/85 sm:text-lg">{copy}</p>
          <ButtonLink href="/sinai-trips" variant="sun" size="lg" className="mt-8">
            {ar ? 'اكتشف سيناء' : 'Explore Sinai'}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}

/* ─────────────────────── PRIMARY DISCOVERY (4 paths) ─────────────────────── */

function PrimaryDiscovery() {
  const locale = useLocale()
  const ar = locale === 'ar'

  const paths = [
    {
      icon: Building2,
      href: '/book-dahab',
      title_ar: 'دهب متظبطة',
      title_en: 'Dahab, sorted',
      body_ar: 'إقامة، انتقالات، أو الباكدج الكامل — اختار اللي يناسب رحلتك.',
      body_en: 'Stay, transfers or the full Dahab package — choose what fits your trip.',
    },
    {
      icon: Mountain,
      href: '/sinai-trips',
      title_ar: 'رحلات سيناء',
      title_en: 'Sinai Trips',
      body_ar: 'من البحر والصحرا للجبال والسهرات — احجز تجربة واحدة وعيشها.',
      body_en: 'Sea, desert, mountains and nights — pick one experience and go.',
    },
    {
      icon: Package,
      href: '/sinai-trips',
      title_ar: 'باقات الرحلات',
      title_en: 'Trip Packages',
      body_ar: 'أكتر من تجربة، متجمعة بسعر أفضل من حجز كل رحلة لوحدها.',
      body_en: 'More experiences together, at a better total than booking them separately.',
    },
    {
      icon: Sparkles,
      href: '/signature',
      title_ar: 'Signature Experiences',
      title_en: 'Signature Experiences',
      body_ar: 'رحلات كاملة متصممة حوالين نوع التجربة — من الهاني مون للغوص والكايت والمغامرة.',
      body_en: 'Complete journeys built around an experience — from honeymoons to diving, kite and adventure.',
    },
  ]

  return (
    <section className="relative section-padding bg-sand-50">
      <TopoBackdrop />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'ابدأ من هنا' : 'Start here'}
          title={ar ? 'إنت جاي سيناء تعمل إيه؟' : 'What brings you to Sinai?'}
          subtitle={ar ? 'ابدأ من نوع الرحلة اللي شبهك.' : "Start with the kind of experience you're looking for."}
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-12">
          {paths.map((path, i) => (
            <Reveal key={path.href + path.title_en} delay={i * 80} className={cn('h-full', i === 0 || i === 3 ? 'lg:col-span-7' : 'lg:col-span-5')}>
              <GlowCard className="h-full">
                <Link
                  href={path.href}
                  className={cn(
                    'hover-lift group flex h-full min-h-64 flex-col border-[1.5px] p-7 pin-card transition-colors md:p-8',
                    i === 3 ? 'border-sea-800 bg-sea-900 text-white hover:border-sun-400/60' : 'border-sand-300 bg-card hover:border-sea-900/25',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn('mb-8 inline-flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[-6deg]', i === 3 ? 'bg-white/10 text-sun-300' : 'bg-sand-100 text-sea-900')}
                  >
                    <path.icon className="h-6 w-6" />
                  </span>
                  <h3 className={cn('font-display text-xl font-semibold', i === 3 ? 'text-white' : 'text-sea-900')}>
                    {ar ? path.title_ar : path.title_en}
                  </h3>
                  <p className={cn('mt-3 max-w-lg text-sm leading-relaxed', i === 3 ? 'text-white/70' : 'text-sea-900/60')}>
                    {ar ? path.body_ar : path.body_en}
                  </p>
                  <span className={cn('mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold transition-colors group-hover:text-sun-500', i === 3 ? 'text-sun-300' : 'text-sea-600')}>
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

/* ─────────────────────────── TRIPS + PACKAGES ─────────────────────────── */

function TripsAndPackages({ trips, packages }: { trips: SinaiTrip[]; packages: TripPackage[] }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const tripPicks = trips.slice(0, 3)
  const packagePicks = packages.slice(0, 1)

  if (tripPicks.length === 0 && packagePicks.length === 0) return null

  return (
    <section className="relative section-padding bg-sand-100">
      <TopoBackdrop />
      <div className="container-main relative">
        <SectionHeading
          eyebrow={ar ? 'رحلات وباقات' : 'Trips & packages'}
          title={ar ? 'اختار تجربتك في سيناء' : 'Choose your Sinai experience'}
          subtitle={ar ? 'رحلة واحدة، أو باكدج يجمع لك أكتر من تجربة بسعر أحسن.' : 'Book one trip, or bundle more of Sinai into a better-value package.'}
          action={
            <ButtonLink href="/sinai-trips" variant="outline-ink" size="lg">
              {ar ? 'عرض الكل' : 'View all'}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
          }
        />

        <ScrollRail cols={3}>
          {tripPicks.map((trip, i) => (
            <Reveal key={trip.id} delay={i * 80} className="w-[78vw] shrink-0 sm:w-auto">
              <TripCard trip={trip} />
            </Reveal>
          ))}
          {packagePicks.map((pkg, i) => (
            <Reveal key={pkg.id} delay={(tripPicks.length + i) * 80} className="w-[78vw] shrink-0 sm:w-auto">
              <TripPackageCard pkg={pkg} />
            </Reveal>
          ))}
        </ScrollRail>
      </div>
    </section>
  )
}

/* ─────────────────────────── STAYS / BOOK DAHAB ─────────────────────────── */

function Stays({ items }: { items: Accommodation[] }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = items.slice(0, 3)

  if (picks.length === 0) return null

  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <SectionHeading
          eyebrow={ar ? 'الإقامة' : 'Stays'}
          title={ar ? 'نام في المكان اللي شبه رحلتك' : 'Stay somewhere that fits your trip'}
          subtitle={ar ? 'فندق، شاليه أو كامب — شوف المكان والسعر وابدأ ترتب دهب.' : 'Hotel, chalet or camp — find your place and start shaping your Dahab stay.'}
          action={
            <ButtonLink href="/book-dahab" variant="outline-ink" size="lg">
              {ar ? 'عرض الكل' : 'View all'}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
          }
        />

        <ScrollRail cols={3}>
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

/* ─────────────────────────── SIGNATURE FEATURE MOMENT ─────────────────────────── */

function SignatureFeature() {
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="relative isolate min-h-[32rem] overflow-hidden bg-sea-900 text-white md:min-h-[38rem]">
      <Image
        src="/media/heroposter.png"
        alt={ar ? 'تجربة Signature في سيناء' : 'A Signature experience in Sinai'}
        fill
        sizes="100vw"
        className="-z-20 object-cover object-center"
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/80 via-black/40 to-black/10 rtl:bg-gradient-to-l" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black/40 via-transparent to-black/10" />
      <div className="container-main flex min-h-[32rem] items-end py-14 md:min-h-[38rem] md:items-center md:py-24">
        <Reveal className="max-w-2xl">
          <span className="eyebrow text-sun-300">WEEMAP SIGNATURE</span>
          <h2 className="mt-5 max-w-xl text-3xl font-extrabold leading-[1.1] sm:text-4xl md:text-5xl">
            {ar ? 'مش كل رحلة تتعمل قطعة قطعة.' : "Some trips shouldn't be built piece by piece."}
          </h2>
          <p className="mt-6 max-w-[36rem] text-base leading-relaxed text-white/85 sm:text-lg">
            {ar
              ? 'Signature Experiences بتجمع المكان والنشاط والشركاء والتفاصيل في تجربة واحدة معمولة لفكرة الرحلة نفسها.'
              : 'Signature Experiences bring the place, activity, partners and details together around one complete idea.'}
          </p>
          <ButtonLink href="/signature" variant="sun" size="lg" className="mt-8">
            {ar ? 'اكتشف Signature Experiences' : 'Explore Signature Experiences'}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}

/* ─────────────────────────── MERCH + RENT ─────────────────────────── */

function MoreFromWeemap() {
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="section-padding bg-sand-100">
      <div className="container-main">
        <SectionHeading
          eyebrow="MORE FROM WEEMAP"
          title={ar ? 'خد اللي تحتاجه معاك' : 'Take more of the experience with you'}
        />

        <div className="grid gap-5 md:grid-cols-2">
          <Reveal className="h-full">
            <Link
              href="/merch"
              className="hover-lift group flex h-full flex-col justify-between border-[1.5px] border-sand-300 bg-card p-8 pin-card transition-colors hover:border-sea-900/25"
            >
              <div>
                <span aria-hidden className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sand-50 text-sea-900">
                  <ShoppingBag className="h-6 w-6" />
                </span>
                <h3 className="font-display text-xl font-semibold text-sea-900">WEEMAP Merch</h3>
                <p className="mt-3 text-sm leading-relaxed text-sea-900/60">
                  {ar ? 'قطع بروح سيناء — للرحلة، للبحر، ولما ترجع.' : 'Pieces with the spirit of Sinai — for the trip, the sea and after you\'re back.'}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition-colors group-hover:text-sun-500">
                {ar ? 'شوف المتجر' : 'Shop Merch'}
                <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </span>
            </Link>
          </Reveal>

          <Reveal delay={80} className="h-full">
            <Link
              href="/rent"
              className="hover-lift group flex h-full flex-col justify-between border-[1.5px] border-sand-300 bg-sea-900 p-8 pin-card text-white transition-colors hover:border-sun-400/60"
            >
              <div>
                <span aria-hidden className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sun-300">
                  <Bike className="h-6 w-6" />
                </span>
                <h3 className="font-display text-xl font-semibold text-white">Rent</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/70">
                  {ar ? 'معدات مختارة باليوم عشان تتحرك أخف وتستمتع أكتر.' : 'Selected gear by the day, so you can travel lighter and enjoy more.'}
                </p>
              </div>
              <span className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-sun-300 transition-colors group-hover:text-sun-200">
                {ar ? 'شوف الإيجارات' : 'Explore Rentals'}
                <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── COMMUNITY ─────────────────────────── */

function Partners() {
  const locale = useLocale()
  const ar = locale === 'ar'

  return (
    <section className="border-y border-white/10 bg-[#1b1b17] py-16 text-sand-50 md:py-20">
      <div className="container-main grid gap-8 md:grid-cols-[1.4fr_0.6fr] md:items-end">
        <Reveal>
          <span className="eyebrow text-sun-300">{ar ? 'شركاء الرحلة' : 'Partners in the journey'}</span>
          <h2 className="mt-4 max-w-3xl font-display text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            {ar ? 'بنبني الرحلة مع الناس اللي عايشة سينا.' : 'The strongest Sinai journeys are built locally.'}
          </h2>
          <p className="mt-5 max-w-2xl leading-relaxed text-sand-100/70">
            {ar ? 'إقامات، أدلاء، ومقدمو تجارب محليون يعرفون المكان ويهتمون بتفاصيله.' : 'Stays, guides and local experience makers who know the place and care about its details.'}
          </p>
        </Reveal>
        <Reveal delay={80} className="md:text-end">
          <ButtonLink href="/partner" variant="outline-light" size="lg">
            {ar ? 'اشتغل مع WEEMAP' : 'Work with WEEMAP'}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}

function Community({ posts }: { posts: CommunityPost[] }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = posts.slice(0, 3)

  if (picks.length === 0) return null

  return (
    <section className="section-padding bg-sand-50">
      <div className="container-main">
        <SectionHeading
          eyebrow={ar ? 'المجتمع' : 'Community'}
          title={ar ? 'اعرف المكان قبل ما توصله' : 'Know the place before you arrive'}
          subtitle={ar ? 'قصص، أدلة وأماكن من سيناء تساعدك تشوف أكتر من مجرد الأماكن المشهورة.' : 'Stories, guides and places from Sinai that take you beyond the obvious stops.'}
          action={
            <ButtonLink href="/community" variant="outline-ink" size="lg">
              {ar ? 'ادخل الكوميونيتي' : 'Explore the Community'}
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

/* ─────────────────────────── FINAL CTA ─────────────────────────── */

function FinalCta({ settings }: { settings: SiteSettings | null }) {
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
            {ar ? 'سيناء مستنياك' : 'Sinai is waiting'}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">
            {ar ? 'اختار البداية وإحنا نساعدك ترتب الباقي.' : "Choose where to start and we'll help you shape the rest."}
          </p>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/book-dahab" size="lg" variant="ink" className="h-13 px-8">
              {ar ? 'ابدأ رحلتك' : 'Start your trip'}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </ButtonLink>
            <a
              href={`https://wa.me/${whatsapp}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-white/60 px-8 text-base font-medium text-white transition-all hover:bg-white/15"
            >
              <MessageCircle className="h-5 w-5" />
              {ar ? 'كلمنا على واتساب' : 'Talk to WEEMAP'}
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
