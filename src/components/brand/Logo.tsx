import { cn } from '@/lib/utils'
import { MapPin } from 'lucide-react'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const MARK: Record<LogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
}

const WORD: Record<LogoSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
  xl: 'text-2xl',
}

/**
 * Single source of truth for the WEEMAP SINAI logo lockup.
 *
 * TEMPORARY MARK — the approved logo direction lives in
 * `_weemap_reference/WEEMAP_REFERENCE_PACK_FINAL/01_brand/logo/weemap-sinai-logo-brand-board.png`
 * (location-pin + hand gesture + Sinai mountain cue), but no production
 * vector exists yet. Until a clean SVG is exported, the mark is a styled
 * pin in WEEMAP orange and the lockup is set in the site's display face:
 *
 *   WEEMAP   (orange)
 *   SINAI    (ink / light)
 *
 * See WEEMAP_ASSET_CHECKLIST.md — replacing the pin with the real mark
 * only touches this file. Deliberately does NOT use /logo.png (that file
 * is the old First Trip artwork and must not be referenced anywhere).
 */
export function Logo({
  size = 'md',
  variant = 'lockup',
  tone = 'ink',
  className,
}: {
  size?: LogoSize
  variant?: 'lockup' | 'mark'
  tone?: 'ink' | 'light'
  className?: string
  priority?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-sun-400/15 text-sun-500',
          MARK[size],
        )}
        aria-hidden
      >
        <MapPin className="h-[60%] w-[60%]" strokeWidth={2.5} />
      </span>

      {variant === 'lockup' && (
        <span
          className={cn(
            'font-display font-extrabold tracking-tight whitespace-nowrap leading-none',
            WORD[size],
          )}
        >
          <span className={tone === 'light' ? 'text-sun-300' : 'text-sun-500'}>WEEMAP</span>
          <span className="mx-1" />
          <span className={tone === 'light' ? 'text-sea-200' : 'text-sea-700'}>SINAI</span>
        </span>
      )}
    </span>
  )
}
