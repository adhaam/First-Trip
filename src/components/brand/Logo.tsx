import Image from 'next/image'
import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const MARK: Record<LogoSize, { px: number; cls: string }> = {
  sm: { px: 32, cls: 'h-7 w-7' },
  md: { px: 44, cls: 'h-9 w-9' },
  lg: { px: 64, cls: 'h-14 w-14' },
  xl: { px: 96, cls: 'h-20 w-20' },
}

const WORD: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
}

/**
 * Single source of truth for the logo lockup.
 *
 * The supplied artwork is a stacked lockup (pin above the wordmark), which
 * reads badly in a 64px-tall header. So everywhere the logo sits inline we
 * crop to just the pin mark and set "FIRST TRIP" in the site's own display
 * face — same brand, correct optical weight. `variant="mark"` gives the pin
 * on its own for tight spots (favicon-ish contexts, mobile bar, avatars).
 */
export function Logo({
  size = 'md',
  variant = 'lockup',
  tone = 'ink',
  className,
  priority = false,
}: {
  size?: LogoSize
  variant?: 'lockup' | 'mark'
  tone?: 'ink' | 'light'
  className?: string
  priority?: boolean
}) {
  const mark = MARK[size]

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'relative shrink-0 overflow-hidden',
          mark.cls,
        )}
      >
        {/*
          The source PNG is a square lockup: the pin occupies roughly the top
          72% and the wordmark the bottom. Scaling up and shifting the image
          inside a square box isolates the pin cleanly without needing a
          re-exported asset.
        */}
        <Image
          src="/logo.png"
          alt="First Trip"
          width={mark.px * 2}
          height={mark.px * 2}
          priority={priority}
          className="absolute left-1/2 top-1/2 w-[132%] max-w-none -translate-x-1/2 -translate-y-[58%]"
        />
      </span>

      {variant === 'lockup' && (
        <span
          className={cn(
            'font-display font-extrabold tracking-tight whitespace-nowrap',
            WORD[size],
          )}
        >
          <span className={tone === 'light' ? 'text-sea-200' : 'text-sea-600'}>FIRST</span>
          <span className="mx-1" />
          <span className={tone === 'light' ? 'text-sun-300' : 'text-sun-400'}>TRIP</span>
        </span>
      )}
    </span>
  )
}
