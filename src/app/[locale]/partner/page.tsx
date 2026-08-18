import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { PartnerClient } from '@/components/PartnerClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'partner' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/partner', locale),
  }
}

export default async function PartnerPage() {
  const settings = await getSiteSettings()
  return <PartnerClient settings={settings} />
}
