import Image from 'next/image'
import { cn } from '@/lib/utils'

type LogoSize = 'sm' | 'md' | 'lg' | 'xl'

const LOCKUP_HEIGHT: Record<LogoSize, string> = {
  sm: 'h-7 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-14 w-auto',
  xl: 'h-20 w-auto',
}

const MARK_SIZE: Record<LogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
}

/**
 * Single source of truth for the WEEMAP SINAI logo — official artwork,
 * never recolored or filtered. `tone="ink"` wraps the mark in a dark
 * chip since the artwork itself is a light cream+orange lockup and
 * requires a dark/high-contrast host surface (see WEEMAP_SINAI_BRAND_PACK
 * usage rules).
 */
export function Logo({
  size = 'md',
  variant = 'lockup',
  tone = 'ink',
  className,
  priority,
}: {
  size?: LogoSize
  variant?: 'lockup' | 'mark'
  tone?: 'ink' | 'light'
  className?: string
  priority?: boolean
}) {
  const image =
    variant === 'lockup' ? (
      <Image
        src="/brand/logo.png"
        alt="WEEMAP SINAI"
        width={1800}
        height={752}
        priority={priority}
        className={cn(LOCKUP_HEIGHT[size], 'object-contain')}
      />
    ) : (
      <Image
        src="/brand/icon-192.png"
        alt="WEEMAP SINAI"
        width={192}
        height={192}
        priority={priority}
        className={cn(MARK_SIZE[size], 'object-contain')}
      />
    )

  if (tone === 'light') {
    return <span className={cn('inline-flex items-center', className)}>{image}</span>
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-xl bg-weemap-charcoal px-2.5 py-1.5',
        className,
      )}
    >
      {image}
    </span>
  )
}
