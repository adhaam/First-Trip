import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { AboutClient } from '@/components/AboutClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'about' })
  return pageMetadata({ locale, path: '/about', title: t('title'), description: t('intro') })
}

export default function AboutPage() {
  return <AboutClient />
}
