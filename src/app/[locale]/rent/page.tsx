import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { buildAlternates } from '@/lib/seo'
import { RentClient } from '@/components/RentClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'future' })
  return {
    title: t('rentTitle'),
    description: t('rentText'),
    alternates: buildAlternates('/rent', locale),
  }
}

export default async function RentPage() {
  const settings = await getSiteSettings()
  return <RentClient whatsapp={settings?.whatsapp_number} />
}
