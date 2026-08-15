import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { RentClient } from '@/components/RentClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/rent', locale) }
}

export default function RentPage() {
  return <RentClient />
}
