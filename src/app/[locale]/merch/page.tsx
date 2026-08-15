import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { MerchClient } from '@/components/MerchClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/merch', locale) }
}

export default function MerchPage() {
  return <MerchClient />
}
