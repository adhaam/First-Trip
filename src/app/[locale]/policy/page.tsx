import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { PolicyClient } from '@/components/PolicyClient'
import { getSiteSettings } from '@/lib/data'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/policy', locale) }
}

export default async function PolicyPage() {
  const settings = await getSiteSettings()
  return <PolicyClient settings={settings} />
}
