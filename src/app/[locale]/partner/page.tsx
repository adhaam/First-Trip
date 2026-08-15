import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { PartnerClient } from '@/components/PartnerClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/partner', locale) }
}

export default function PartnerPage() {
  return <PartnerClient />
}
