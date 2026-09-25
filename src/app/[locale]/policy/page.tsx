import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { PolicyClient } from '@/components/PolicyClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'policy' })
  return pageMetadata({
    locale,
    path: '/policy',
    title: t('title'),
    description: t('subtitle'),
  })
}

export default async function PolicyPage() {
  const settings = await getSiteSettings()
  return <PolicyClient settings={settings} />
}
