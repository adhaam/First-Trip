import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Reveal } from '@/components/motion/Reveal'

const SECTION_TONE = {
  paper: 'bg-sand-50 text-ink',
  sand: 'bg-sand-100 text-ink',
  night: 'surface-night grain',
  sea: 'bg-sea-700 text-sand-50',
} as const

const SECTION_SIZE = {
  sm: 'py-8 sm:py-10 md:py-14',
  md: 'section-padding',
  lg: 'py-14 sm:py-20 md:py-32',
} as const

/**
 * The alternating night/paper/sand/sea rhythm the whole site is built on
 * (see "Contrast of surfaces" in docs/m2/BRIEF.md). Owns background, text
 * colour and vertical rhythm so a page is built by stacking `<Section>`s
 * rather than every page re-deciding its own padding and surface colour.
 */
export function Section({
  tone = 'paper',
  size = 'md',
  id,
  className,
  children,
}: {
  tone?: keyof typeof SECTION_TONE
  size?: keyof typeof SECTION_SIZE
  id?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      id={id}
      className={cn('relative', SECTION_TONE[tone], SECTION_SIZE[size], className)}
    >
      <div className="container-main relative">{children}</div>
    </section>
  )
}

/**
 * Section heading with the brand's hand-drawn brush underline.
 * `align` defaults to start (not centre) — centred headings on every single
 * section is the tell-tale template rhythm we're avoiding.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'start',
  tone = 'ink',
  className,
  action,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  align?: 'start' | 'center'
  tone?: 'ink' | 'light'
  className?: string
  action?: ReactNode
}) {
  return (
    <div
      className={cn(
        'mb-7 flex flex-col gap-4 sm:mb-10 md:mb-14',
        action && 'md:flex-row md:items-end md:justify-between',
        className,
      )}
    >
      <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && (
          <span
            className={cn(
              'eyebrow mb-3',
              tone === 'light' ? 'text-sun-300' : 'text-sun-700',
            )}
          >
            <span aria-hidden className="h-px w-6 bg-current" />
            {eyebrow}
          </span>
        )}
        <h2
          className={cn(
            'text-3xl font-bold leading-tight sm:text-4xl md:text-[2.6rem]',
            tone === 'light' ? 'text-white' : 'text-sea-900',
          )}
        >
          <span className="brush-underline">{title}</span>
        </h2>
        {subtitle && (
          <p
            className={cn(
              'mt-4 text-base leading-relaxed md:text-lg',
              tone === 'light' ? 'text-sea-100/80' : 'text-ink-muted',
            )}
          >
            {subtitle}
          </p>
        )}
      </Reveal>

      {action && <Reveal delay={80} className="shrink-0">{action}</Reveal>}
    </div>
  )
}

/**
 * Torn-paper divider between a sand section and a sea section. Two offset
 * curves rather than one perfect sine wave, so the edge reads as drawn.
 */
export function WaveDivider({
  className,
  flip = false,
  fill = 'currentColor',
}: {
  className?: string
  flip?: boolean
  fill?: string
}) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none w-full leading-[0]', flip && 'rotate-180', className)}
    >
      <svg
        viewBox="0 0 1440 90"
        preserveAspectRatio="none"
        className="block h-[38px] w-full md:h-[64px]"
      >
        <path
          fill={fill}
          d="M0 44c108-26 186 14 292 18 106 5 168-30 274-30 106 0 174 34 280 34 106 0 176-32 282-32 78 0 150 18 224 26 44 5 88 5 88 5V0H0Z"
        />
      </svg>
    </div>
  )
}

/** Faint contour-line backdrop. Purely decorative. */
export function TopoBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 topo-bg opacity-70', className)}
    />
  )
}
