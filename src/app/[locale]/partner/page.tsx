import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { PartnerClient } from '@/components/PartnerClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/partner', locale) }
}

export default async function PartnerPage() {
  const settings = await getSiteSettings()
  return <PartnerClient settings={settings} />
}
