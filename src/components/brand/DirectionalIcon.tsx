import { ArrowRight, ChevronRight, ArrowLeft, type LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Directional icons that flip in RTL instead of just sitting mirrored by
 * accident. `rtl:-scale-x-100` is the flip; every other prop passes through
 * to the underlying Lucide glyph.
 *
 * "Forward" always means "the direction reading progresses" (end of the
 * line, not literally right) — so `ArrowForward` points right in LTR and
 * left in RTL, which is what "next / continue / view" actually means to
 * the reader in each direction.
 */
export function ArrowForward({ className, ...props }: LucideProps) {
  return <ArrowRight className={cn('rtl:-scale-x-100', className)} aria-hidden {...props} />
}

export function ChevronForward({ className, ...props }: LucideProps) {
  return <ChevronRight className={cn('rtl:-scale-x-100', className)} aria-hidden {...props} />
}

/** The reverse of ArrowForward — "back / previous". */
export function ArrowBack({ className, ...props }: LucideProps) {
  return <ArrowLeft className={cn('rtl:-scale-x-100', className)} aria-hidden {...props} />
}
