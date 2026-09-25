import type { ReactNode } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/motion/Reveal'

const HERO_SIZE = {
  md: 'min-h-[56vh] sm:min-h-[60vh]',
  lg: 'min-h-[72vh] sm:min-h-[78vh]',
  full: 'min-h-[100svh]',
} as const

const HERO_TONE = {
  paper: 'bg-sand-100',
  sand: 'bg-sand-200',
  night: 'bg-sea-900',
  sea: 'bg-sea-700',
} as const

/**
 * Cinematic list-page hero — image or video backdrop, scrim, one heading.
 * Server-safe: no hooks of its own, so a page can render it above the fold
 * without shipping client JS for it.
 *
 * The scrim is two stacked layers so the text is never at the photo's mercy:
 * a bottom-weighted gradient (near-opaque at the text zone, fading to a
 * light wash at the top) plus the brand's topo texture blended over it.
 * White/sand-50 text on the gradient's dark stop clears 4.5:1 against any
 * photo, because that stop is dark regardless of what's under it.
 */
export function PageHero({
  image,
  video,
  eyebrow,
  title,
  lede,
  actions,
  tone = 'night',
  size = 'lg',
  align = 'start',
  className,
}: {
  image?: string
  video?: string
  eyebrow?: ReactNode
  title: ReactNode
  lede?: ReactNode
  actions?: ReactNode
  tone?: keyof typeof HERO_TONE
  size?: keyof typeof HERO_SIZE
  align?: 'start' | 'center'
  className?: string
}) {
  return (
    <section
      className={cn(
        'relative flex overflow-hidden text-sand-50',
        align === 'center' ? 'items-center' : 'items-end',
        HERO_SIZE[size],
        HERO_TONE[tone],
        className,
      )}
    >
      {video ? (
        <video
          src={video}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : image ? (
        <Image
          src={image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 object-cover"
        />
      ) : null}

      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-sea-900/92 via-sea-900/40 to-sea-900/10"
      />
      <div aria-hidden className="topo-bg absolute inset-0 opacity-30 mix-blend-overlay" />

      <div
        className={cn(
          'container-main relative py-12 sm:py-16 md:py-20',
          align === 'center' && 'text-center',
        )}
      >
        <Reveal always className={cn('max-w-2xl', align === 'center' && 'mx-auto')}>
          {eyebrow && <div className="mb-4">{eyebrow}</div>}
          <h1 className="font-display text-4xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
            {title}
          </h1>
          {lede && (
            <p className="mt-4 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg">{lede}</p>
          )}
          {actions && (
            <div className={cn('mt-7 flex flex-wrap gap-3', align === 'center' && 'justify-center')}>
              {actions}
            </div>
          )}
        </Reveal>
      </div>
    </section>
  )
}
