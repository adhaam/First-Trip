import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { listPublicEditions } from '@/lib/editions-data'
import { Eyebrow, Section } from '@/components/brand'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { EditionsLandingGrid } from '@/components/editions/EditionsLandingGrid'
import { pageMetadata } from '@/lib/seo'
import { getSitePage } from '@/lib/site-pages'
import { pickCopy } from '@/lib/site-pages-core'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'editions' })
  return pageMetadata({ locale, path: '/editions', title: t('landing.heroTitle'), description: t('landing.heroBody') })
}

export default async function EditionsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const isAr = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'editions' })
  const [editions, sitePage] = await Promise.all([listPublicEditions(), getSitePage('experiences')])

  // "Upcoming Editions" = every publicly visible Edition except COMING_SOON
  // (its own "On the way" section) and COMPLETED (nothing left to join/ask).
  const upcoming = editions.filter((e) => e.status !== 'COMING_SOON' && e.status !== 'COMPLETED')
  const comingSoon = editions.filter((e) => e.status === 'COMING_SOON')

  // Owner overrides (Website admin → Pages, site_pages 'experiences') — every
  // field falls back to the designed editions.json landing.* copy when unset.
  const heroImage = sitePage?.hero_image_url || null
  const heroEyebrow = pickCopy(locale, { en: sitePage?.eyebrow_en, ar: sitePage?.eyebrow_ar }, t('landing.eyebrow'))
  const heroTitle = pickCopy(locale, { en: sitePage?.title_en, ar: sitePage?.title_ar }, t('landing.heroTitle'))
  const heroBody = pickCopy(locale, { en: sitePage?.body_en, ar: sitePage?.body_ar }, t('landing.heroBody'))

  return (
    <div className="bg-sand-50">
      <section className="relative isolate overflow-hidden bg-sea-900 py-14 text-white grain md:py-20">
        {heroImage && (
          <>
            <Image src={heroImage} alt="" fill priority sizes="100vw" className="absolute inset-0 object-cover" />
            {/* Same opaque-bottom scrim rationale as /signature (now unreachable) and /community:
                a strong, guaranteed-dark gradient keeps 4.5:1 contrast regardless of the photo. */}
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-sea-900 from-10% via-sea-900/80 via-60% to-sea-900/40"
            />
          </>
        )}
        <div className="container-main relative">
          <Eyebrow tone="light">{heroEyebrow}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {heroTitle}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {heroBody}
          </p>
        </div>
      </section>

      <Section tone="paper" size="lg">
        <EditionsLandingGrid bookable={upcoming} comingSoon={comingSoon} locale={isAr ? 'ar' : 'en'} />
      </Section>

      <Section tone="night" size="md">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow tone="light">{t('landing.customTitle')}</Eyebrow>
          <p className="mt-4 text-base leading-relaxed text-sea-100/80 sm:text-lg">{t('landing.customBody')}</p>
          <Link
            href="/editions/custom"
            className={[
              'mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-sun-500 px-7',
              'text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600',
            ].join(' ')}
          >
            {t('landing.customButton')}
            <ArrowForward className="h-4 w-4" />
          </Link>
        </div>
      </Section>
    </div>
  )
}
