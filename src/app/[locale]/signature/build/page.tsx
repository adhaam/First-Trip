import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { SignatureRequestForm } from '@/components/SignatureRequestForm'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signature' })
  return {
    title: t('buildTitle'),
    description: t('buildBody'),
    alternates: buildAlternates('/signature/build', locale),
  }
}

export default async function BuildYourSignaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signature' })

  return (
    <div className="bg-sand-50">
      <section className="bg-weemap-charcoal py-16 text-center text-white md:py-20">
        <div className="container-main">
          <Link href="/signature" className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-white/70 hover:text-white">
            <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" />
            {t('backToSignature')}
          </Link>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{t('buildTitle')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-sand-100/80">{t('buildBody')}</p>
        </div>
      </section>

      <section className="section-padding">
        <div className="container-main max-w-2xl">
          <div className="rounded-3xl border-[1.5px] border-sand-300 bg-card p-6 md:p-8">
            <h2 className="mb-5 font-display text-xl font-bold text-sea-900">{t('buildFormTitle')}</h2>
            <SignatureRequestForm />
          </div>
        </div>
      </section>
    </div>
  )
}
