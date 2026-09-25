import { MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The one truth line every trip and package surface repeats verbatim:
 * pickup & drop-off is always from the guest's accommodation in Dahab.
 * Server-safe — callers pass the already-translated `label` (`explore.pickup`)
 * so this never needs its own client boundary just to read a string.
 */
export function PickupNote({
  label,
  tone = 'ink',
  className,
}: {
  label: string
  tone?: 'ink' | 'light'
  className?: string
}) {
  return (
    <p
      className={cn(
        'flex items-start gap-2 text-sm font-medium leading-5',
        tone === 'light' ? 'text-sand-100' : 'text-sea-900',
        className,
      )}
    >
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-sun-700" aria-hidden />
      {label}
    </p>
  )
}
