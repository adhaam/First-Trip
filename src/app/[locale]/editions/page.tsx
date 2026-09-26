import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { listPublicEditions } from '@/lib/editions-data'
import { Eyebrow, Section } from '@/components/brand'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { EditionsLandingGrid } from '@/components/editions/EditionsLandingGrid'
import { pageMetadata } from '@/lib/seo'

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
  const editions = await listPublicEditions()

  // "Upcoming Editions" = every publicly visible Edition except COMING_SOON
  // (its own "On the way" section) and COMPLETED (nothing left to join/ask).
  const upcoming = editions.filter((e) => e.status !== 'COMING_SOON' && e.status !== 'COMPLETED')
  const comingSoon = editions.filter((e) => e.status === 'COMING_SOON')

  return (
    <div className="bg-sand-50">
      <section className="relative isolate bg-sea-900 py-14 text-white grain md:py-20">
        <div className="container-main">
          <Eyebrow tone="light">{t('landing.eyebrow')}</Eyebrow>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-extrabold leading-tight sm:text-5xl">
            {t('landing.heroTitle')}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
            {t('landing.heroBody')}
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
