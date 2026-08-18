import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { MerchClient } from '@/components/MerchClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'future' })
  return {
    title: t('merchTitle'),
    description: t('merchText'),
    alternates: buildAlternates('/merch', locale),
  }
}

export default async function MerchPage() {
  const settings = await getSiteSettings()
  return <MerchClient whatsapp={settings?.whatsapp_number} />
}
