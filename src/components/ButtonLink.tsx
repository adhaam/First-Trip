import type { ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/80',
  orange: 'bg-brand-orange text-white hover:bg-brand-orange-dark shadow-sm',
  outline: 'border border-border bg-background hover:bg-muted hover:text-foreground',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  ghost: 'hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
  link: 'text-primary underline-offset-4 hover:underline',
  whatsapp: 'bg-green-600 text-white hover:bg-green-700',
  'whatsapp-outline': 'border border-green-500 text-green-600 hover:bg-green-50',
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
        'inline-flex items-center justify-center rounded-full font-medium transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 gap-1.5 whitespace-nowrap',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </Link>
  )
}
