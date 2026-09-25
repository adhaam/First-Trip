import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { Eyebrow } from '@/components/brand/Eyebrow'
import { ArrowBack } from '@/components/brand/DirectionalIcon'
import { SignatureBuildWizard } from '@/components/signature/SignatureBuildWizard'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })
  return {
    title: t('buildTitle'),
    description: t('buildBody'),
    alternates: buildAlternates('/signature/build', locale),
  }
}

export default async function BuildYourSignaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signatureV2' })

  return (
    <div className="bg-sand-50">
      <section className="bg-sea-900 py-14 text-center text-white md:py-20 grain">
        <div className="container-main">
          <Link
            href="/signature"
            className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/70 hover:text-white"
          >
            <ArrowBack className="h-4 w-4" />
            {t('backToSignature')}
          </Link>
          <Eyebrow tone="light" className="justify-center">{t('buildEyebrow')}</Eyebrow>
          <h1 className="mt-4 font-display text-3xl font-bold sm:text-4xl">{t('buildTitle')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-sand-100/80">{t('buildBody')}</p>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-main max-w-3xl">
          <SignatureBuildWizard />
        </div>
      </section>
    </div>
  )
}
