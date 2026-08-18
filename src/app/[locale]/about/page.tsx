import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { AboutClient } from '@/components/AboutClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })
  return {
    title: t('title'),
    description: t('intro'),
    alternates: buildAlternates('/about', locale),
  }
}

export default function AboutPage() {
  return <AboutClient />
}
