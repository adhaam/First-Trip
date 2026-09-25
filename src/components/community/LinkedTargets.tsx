import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { NEUTRAL_MEDIA } from '@/lib/media'
import type { CommunityLinkedTarget } from '@/lib/types'

/** /plan prefill param this target type supports — signature_experience has
 *  no Trip Builder prefill today (only trip/trip_package/stay do), so it
 *  links straight to its own page instead of pretending to prefill /plan. */
function planHref(target: CommunityLinkedTarget): string | null {
  if (target.target_type === 'stay') return `/plan?stay=${target.target_id}`
  if (target.target_type === 'trip') return `/plan?trip=${target.target_id}`
  if (target.target_type === 'trip_package') return `/plan?package=${target.target_id}`
  return null
}

export function LinkedTargets({
  targets,
  locale,
  heading,
  planCtaLabel,
  viewCtaLabel,
}: {
  targets: CommunityLinkedTarget[]
  locale: string
  heading: string
  planCtaLabel: string
  viewCtaLabel: string
}) {
  if (targets.length === 0) return null
  const ar = locale === 'ar'

  return (
    <div className="mt-6">
      <h3 className="font-display text-base font-bold text-sea-900">{heading}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {targets.map((target) => {
          const title = ar ? target.title_ar || target.title_en : target.title_en || target.title_ar
          const plan = planHref(target)
          return (
            <div key={`${target.target_type}:${target.target_id}`} className="flex items-center gap-3 rounded-2xl border-[1.5px] border-sand-300 bg-card p-3">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                <Image src={target.image || NEUTRAL_MEDIA} alt={title} fill sizes="56px" className="object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sea-900">{title}</p>
                <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
                  <Link href={target.pathname} className="inline-flex items-center gap-1 text-sea-900 hover:underline">
                    {viewCtaLabel}
                    <ArrowForward className="h-3 w-3" />
                  </Link>
                  {plan && (
                    <Link href={plan} className="inline-flex items-center gap-1 text-sun-700 hover:underline">
                      {planCtaLabel}
                      <ArrowForward className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
