import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { PolicyClient } from '@/components/PolicyClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/policy', locale) }
}

export default function PolicyPage() {
  return <PolicyClient />
}
