import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { ArrowBack } from '@/components/brand/DirectionalIcon'
import { SignatureBuildWizard } from '@/components/signature/SignatureBuildWizard'
import { pageMetadata } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'editions' })
  return pageMetadata({
    locale,
    path: '/editions/custom',
    title: t('landing.customTitle'),
    description: t('landing.customBody'),
    // A custom-request wizard, not a distinct catalog entity to rank —
    // same treatment as the pre-existing /signature/build page it reuses.
    robots: { index: false, follow: true },
  })
}

export default async function CustomEditionPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'editions' })

  return (
    <div className="bg-sand-50">
      <section className="bg-sea-900 py-14 text-center text-white md:py-20 grain">
        <div className="container-main">
          <Link
            href="/editions"
            className={[
              'mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold',
              'text-white/70 hover:text-white',
            ].join(' ')}
          >
            <ArrowBack className="h-4 w-4" />
            {t('landing.upcomingTitle')}
          </Link>
          <Eyebrow tone="light" className="justify-center">{t('landing.eyebrow')}</Eyebrow>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{t('landing.customTitle')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-sand-100/80">{t('landing.customBody')}</p>
        </div>
      </section>

      {/*
        SignatureBuildWizard is the same free-form brief flow behind
        /signature/build — this page only retitles it as the Custom Edition
        entry point. It still posts to /api/experience-requests: Editions
        does not fork that pipeline, it only relabels the public surface.
      */}
      <section className="section-padding">
        <div className="container-main max-w-3xl">
          <SignatureBuildWizard />
        </div>
      </section>
    </div>
  )
}
