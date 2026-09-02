import type { Metadata } from 'next'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowUpRight } from 'lucide-react'
import { getExperienceCategories, getExperiences } from '@/lib/experiences'
import { SignatureClient } from '@/components/SignatureClient'
import { WaveDivider } from '@/components/brand/Section'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signature' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/signature', locale),
  }
}

export default async function SignaturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signature' })
  const [categories, experiences] = await Promise.all([getExperienceCategories(), getExperiences()])

  return (
    <div className="bg-sand-50">
      <section className="relative overflow-hidden bg-weemap-charcoal py-24 text-center text-white md:py-32 grain">
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-weemap-orange">
            <span aria-hidden className="h-px w-6 bg-current" />
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-sand-100/60">{t('body')}</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#experiences"
              className="inline-flex h-12 items-center gap-2 rounded-full bg-weemap-orange px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
            >
              {t('primaryCta')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
            <Link
              href="/signature/build"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/30 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t('secondaryCta')}
              <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
            </Link>
          </div>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <SignatureClient categories={categories} experiences={experiences} />
        </div>
      </section>
    </div>
  )
}
