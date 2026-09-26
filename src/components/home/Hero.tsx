'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useCallback, useState, useSyncExternalStore } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ButtonLink } from '@/components/ButtonLink'
import { Logo } from '@/components/brand/Logo'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { WaveDivider } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { cn } from '@/lib/utils'
import type { SiteSettings } from '@/lib/types'
import { pickCopy, type SitePage } from '@/lib/site-pages-core'

const WIDE_QUERY = '(min-width: 1024px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the decorative hero video is worth downloading for this client.
 * `useSyncExternalStore` rather than an effect: matchMedia and the Network
 * Information API are external systems, the server snapshot is pinned to
 * false so SSR and the first client render agree, and the answer updates if
 * the viewport is resized or the motion preference changes mid-session.
 */
function useHeroVideoEnabled(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === 'undefined' || !window.matchMedia) return () => {}
    const wide = window.matchMedia(WIDE_QUERY)
    const motion = window.matchMedia(REDUCED_MOTION_QUERY)
    wide.addEventListener('change', onChange)
    motion.addEventListener('change', onChange)
    return () => {
      wide.removeEventListener('change', onChange)
      motion.removeEventListener('change', onChange)
    }
  }, [])

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    if (!window.matchMedia(WIDE_QUERY).matches) return false
    if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return false

    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection
    if (connection?.saveData === true) return false
    if (connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g') return false
    return true
  }, [])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

/**
 * WEEMAP video-first hero — "WE MAP SINAI. YOU LIVE IT." Full-viewport
 * cinematic video (desktop only), poster fallback everywhere else. Every bit
 * of motion already lives inside the video itself, so there's deliberately no
 * scroll-driven choreography, parallax or canvas here.
 *
 * Loading policy: the video is not requested at all unless the viewport is
 * wide, `prefers-reduced-motion` is off, and the connection isn't
 * Save-Data/2g — see the decision inside `useHeroVideoEnabled`. Dashboard
 * copy (Site Settings → Homepage) overrides the brand default when set.
 *
 * `sitePage` (site_pages 'home', Website admin → Pages) can additionally
 * override the hero image and disables the brand video in that case — a
 * custom photo replaces the cinematic loop rather than sitting behind it.
 */
export function Hero({ settings, sitePage }: { settings: SiteSettings | null; sitePage?: SitePage | null }) {
  const t = useTranslations('homeV2.hero')
  const locale = useLocale()
  const ar = locale === 'ar'
  const posterSrc = sitePage?.hero_image_url || '/media/heroposter.webp'
  const hasCustomHeroImage = Boolean(sitePage?.hero_image_url)

  const [videoReady, setVideoReady] = useState(false)
  const playVideo = useHeroVideoEnabled() && !hasCustomHeroImage
  const revealVideo = () => setVideoReady(true)

  // The headline is the brand line and never changes. Owner-editable hero copy
  // (Site Settings → Homepage, then Website admin → Pages) overrides the
  // brand default when set — it becomes the lede.
  const ownerLede = [
    ar ? settings?.hero_heading_ar : settings?.hero_heading_en,
    ar ? settings?.hero_subheading_ar : settings?.hero_subheading_en,
  ].filter(Boolean).join(' — ')
  const lede = pickCopy(locale, { en: sitePage?.body_en, ar: sitePage?.body_ar }, ownerLede || t('lede'))

  const primaryLabel = (ar ? settings?.primary_cta_label_ar : settings?.primary_cta_label_en) || t('primaryCta')
  const secondaryLabel = (ar ? settings?.secondary_cta_label_ar : settings?.secondary_cta_label_en) || t('secondaryCta')

  return (
    <section className="relative isolate flex min-h-svh items-center overflow-hidden bg-sea-900">
      <div className="absolute inset-0 -z-10">
        <Image
          src={posterSrc}
          alt={t('alt')}
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />

        {playVideo && (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
            tabIndex={-1}
            poster={posterSrc}
            onCanPlay={revealVideo}
            onPlay={revealVideo}
            className={cn(
              'absolute inset-0 h-full w-full object-cover motion-reduce:hidden',
              'transition-opacity duration-700',
              videoReady ? 'opacity-100' : 'opacity-0',
            )}
          >
            <source src="/media/herovideo-720.webm" type="video/webm" />
            <source src="/media/herovideo-720.mp4" type="video/mp4" />
          </video>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
        <div className="absolute inset-0 bg-black/10" />
      </div>

      <div className="container-main relative z-10 py-28 md:py-32">
        <div className="max-w-2xl">
          <Reveal always>
            <Eyebrow tone="light" coords="28.49°N · 34.51°E">
              {t('location')}
            </Eyebrow>
          </Reveal>

          <Reveal always>
            <h1
              className={cn(
                'mt-6 font-display text-[2.6rem] font-bold text-white sm:text-6xl lg:text-7xl',
                // Latin gets the brand's tight, uppercase display treatment;
                // Arabic never gets letter-spacing or uppercase (no case to
                // begin with) and needs more headline line-height instead —
                // see "Type" in docs/m2/BRIEF.md.
                ar ? 'leading-[1.4]' : 'uppercase leading-[1.05] tracking-tight',
              )}
            >
              <span className="block">{t('heading')}</span>
              <span className="mt-2 block text-sun-300">{t('subheading')}</span>
            </h1>
          </Reveal>

          <Reveal always>
            <p className="mt-7 max-w-xl text-base leading-relaxed text-sand-100/85 sm:text-lg">
              {lede}
            </p>
          </Reveal>

          <Reveal always>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink href="/plan" size="xl" variant="sun" className="group justify-center">
                {primaryLabel}
                <ArrowForward className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </ButtonLink>

              <ButtonLink href="/explore" size="xl" variant="outline-light" className="justify-center backdrop-blur">
                {secondaryLabel}
              </ButtonLink>
            </div>
          </Reveal>

          <Reveal always>
            <div className="mt-12 inline-flex items-center gap-3 border-s-2 border-sun-400/70 ps-4">
              <Logo size="sm" variant="mark" tone="light" />
              <p className="text-sm leading-snug text-sand-100/70">
                {t.rich('originText', {
                  place: t('originPlace'),
                  b: (chunks) => <strong className="font-semibold text-white">{chunks}</strong>,
                })}
              </p>
            </div>
          </Reveal>
        </div>
      </div>

      <WaveDivider className="absolute inset-x-0 bottom-0 z-10 text-sand-50" />
    </section>
  )
}
