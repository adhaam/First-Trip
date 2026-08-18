import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function TripNotFound() {
  const t = await getTranslations('tripDetail')

  return (
    <main className="container-main flex min-h-[65svh] items-center justify-center py-20 text-center">
      <div className="max-w-lg">
        <p className="eyebrow justify-center text-sun-600">404</p>
        <h1 className="mt-4 font-display text-4xl font-bold text-sea-900">{t('notFoundTitle')}</h1>
        <p className="mt-4 leading-7 text-sea-900/65">{t('notFoundText')}</p>
        <Link href="/sinai-trips" className="mt-7 inline-flex min-h-12 items-center justify-center rounded-md bg-sun-500 px-6 font-semibold text-white hover:bg-sun-600">
          {t('backToTrips')}
        </Link>
      </div>
    </main>
  )
}
