import type { ReactNode } from 'react'
// Locale-aware Link — plain next/link would drop the /en prefix and bounce
// English visitors back to the Arabic route.
import { Link } from '@/i18n/navigation'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  ink: 'bg-sea-900 text-sand-50 hover:bg-sea-700',
  sun: 'bg-sun-400 text-on-accent hover:bg-sun-500',
  'outline-ink': 'border-[1.5px] border-sea-900 text-sea-900 hover:bg-sea-900 hover:text-sand-50',
  'outline-light': 'border-[1.5px] border-white/45 text-white hover:bg-white/10 hover:border-white/70',
  orange: 'bg-brand-orange text-on-accent hover:bg-brand-orange-dark shadow-sm',
  outline: 'border border-border bg-background hover:bg-muted hover:text-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  link: 'text-primary underline-offset-4 hover:underline',
  whatsapp: 'bg-[#25D366] text-on-accent hover:bg-[#1FBE59]',
  'whatsapp-outline': 'border border-[#128C4A] text-[#0F7A40] hover:bg-[#25D366]/15',
}

const sizes = {
  default: 'h-9 px-4 text-sm',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-12 px-8 text-base',
  xl: 'h-14 px-10 text-lg',
  icon: 'h-9 w-9',
}

interface Props {
  href: string
  className?: string
  variant?: keyof typeof variants
  size?: keyof typeof sizes
  children: ReactNode
  target?: string
  rel?: string
}

export function ButtonLink({
  href,
  className,
  variant = 'default',
  size = 'default',
  children,
  target,
  rel,
}: Props) {
  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 gap-1.5 whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </Link>
  )
}
