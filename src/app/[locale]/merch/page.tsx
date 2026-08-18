import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { MerchClient } from '@/components/MerchClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/merch', locale) }
}

export default async function MerchPage() {
  const settings = await getSiteSettings()
  return <MerchClient whatsapp={settings?.whatsapp_number} />
}
