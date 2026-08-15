import type { Metadata } from 'next'
import { buildAlternates } from '@/lib/seo'
import { AboutClient } from '@/components/AboutClient'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/about', locale) }
}

export default function AboutPage() {
  return <AboutClient />
}
