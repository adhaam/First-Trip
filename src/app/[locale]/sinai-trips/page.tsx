import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { getSinaiTrips } from '@/lib/data'
import { SinaiTripsClient } from '@/components/SinaiTripsClient'

export const revalidate = 60 // re-fetch from Supabase at most once a minute

export default async function SinaiTripsPage() {
  const t = await getTranslations('sinai')
  const trips = await getSinaiTrips()

  return (
    <div>
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white py-20 md:py-28 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <Image src="https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=1920&q=80" alt="" fill className="object-cover" />
        </div>
        <div className="container-main relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
          <p className="text-lg text-orange-100 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </section>

      {/* Filter + Grid */}
      <section className="section-padding bg-gray-50">
        <div className="container-main">
          <SinaiTripsClient trips={trips} />
        </div>
      </section>
    </div>
  )
}
