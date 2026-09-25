import type { ReactNode } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { ArrowForward } from './DirectionalIcon'

const SIZE = {
  lg: {
    aspect: 'aspect-[4/3] sm:aspect-[16/9]',
    title: 'text-2xl sm:text-3xl md:text-4xl',
    pad: 'p-6 sm:p-8',
  },
  md: {
    aspect: 'aspect-[3/2]',
    title: 'text-lg sm:text-xl',
    pad: 'p-5',
  },
  sm: {
    aspect: 'aspect-[4/3]',
    title: 'text-base',
    pad: 'p-4',
  },
} as const

/**
 * The one card shape used everywhere content is browsed — trips, stays,
 * packages, community posts, merch. `size` is what creates "hierarchy over
 * uniformity" (docs/m2/BRIEF.md): one `lg` hero card beside a row of `sm`
 * cards reads as curated; a grid of identical cards reads as a catalogue.
 *
 * Image cover only — `alt=""` is deliberate, not an oversight. The title
 * already renders as real text in the same link, so the image is decorative
 * relative to it and a screen reader would otherwise announce the same
 * string twice.
 */
export function EditorialCard({
  href,
  image,
  title,
  kicker,
  meta,
  badge,
  size = 'md',
  priority = false,
  className,
}: {
  href: string
  image: string
  title: ReactNode
  kicker?: ReactNode
  meta?: ReactNode
  badge?: ReactNode
  size?: keyof typeof SIZE
  priority?: boolean
  className?: string
}) {
  const s = SIZE[size]

  return (
    <GlowCard className={cn('rail-snap-item h-full', className)}>
      <Link
        href={href}
        className="group block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3"
      >
        <article className="hover-lift h-full overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
          <div className={cn('slow-zoom relative', s.aspect)}>
            <Image
              src={image}
              alt=""
              fill
              priority={priority}
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/15 to-transparent"
            />

            {badge && (
              <span className="absolute start-3 top-3 rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
                {badge}
              </span>
            )}

            <span
              aria-hidden
              className="absolute end-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur transition-all duration-300 group-hover:bg-sun-500 group-hover:text-on-accent"
            >
              <ArrowForward className="h-4 w-4" />
            </span>

            <div className={cn('absolute inset-x-0 bottom-0', s.pad)}>
              {kicker && <p className="eyebrow mb-1.5 text-sun-300">{kicker}</p>}
              <h3 className={cn('font-display font-bold leading-snug text-white drop-shadow', s.title)}>
                {title}
              </h3>
              {meta && (
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/85">{meta}</div>
              )}
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
