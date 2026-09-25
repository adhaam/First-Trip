import { SafeImage as Image } from '@/components/SafeImage'
import type { TripPackageTrip } from '@/lib/types'
import { NEUTRAL_MEDIA } from '@/lib/media'

/** The package detail page's "what's inside" grid — cover image plus name only; price stays server-side (`totals`). */
export function PackageTripsGrid({ trips, locale }: { trips: TripPackageTrip[]; locale: string }) {
  const ar = locale === 'ar'

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {trips.map((trip) => (
        <article key={trip.id} className="overflow-hidden rounded-2xl border border-sand-300 bg-card">
          <div className="relative aspect-[16/9]">
            <Image
              src={trip.image || NEUTRAL_MEDIA}
              alt={ar ? trip.name_ar : trip.name_en}
              fill
              sizes="(max-width: 640px) 100vw, 45vw"
              className="object-cover"
            />
          </div>
          <h3 className="p-4 font-display font-bold text-sea-900">{ar ? trip.name_ar : trip.name_en}</h3>
        </article>
      ))}
    </div>
  )
}
