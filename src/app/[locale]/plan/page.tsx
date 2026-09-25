import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { TripBuilder } from '@/components/trip-builder/TripBuilder'
import { buildAlternates } from '@/lib/seo'
import { getTripBuilderCatalog } from '@/lib/trip-builder/catalog.server'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'builder' })
  return { title: t('metaTitle'), description: t('metaDescription'), alternates: buildAlternates('/plan', locale) }
}

export default async function PlanPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, prefill, catalog] = await Promise.all([params, searchParams, getTripBuilderCatalog()])
  return <TripBuilder catalog={catalog} locale={locale === 'ar' ? 'ar' : 'en'} prefill={prefill}/>
}
