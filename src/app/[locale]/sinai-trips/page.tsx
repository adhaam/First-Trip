import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { getSinaiTrips, getSiteSettings } from '@/lib/data'
import { SinaiTripsClient } from '@/components/SinaiTripsClient'
import { WaveDivider } from '@/components/brand/Section'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60 // re-fetch from Supabase at most once a minute

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return { alternates: buildAlternates('/sinai-trips', locale) }
}

export default async function SinaiTripsPage() {
  const t = await getTranslations('sinai')
  const [trips, settings] = await Promise.all([getSinaiTrips(), getSiteSettings()])
  const heroImage = trips[0]?.images?.[0] || '/media/heroposter.png'

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-25">
          <Image src={heroImage} alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {t('title')}
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      {/* Filter + Grid */}
      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <SinaiTripsClient trips={trips} whatsapp={settings?.whatsapp_number} />
        </div>
      </section>
    </div>
  )
}
