'use client'

import { Search, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

/**
 * The one in-page search field (as opposed to `<GlobalSearch>`, the header's
 * command-palette-style site search). Controlled, so callers own debouncing
 * and filtering logic themselves.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  label: string
  className?: string
}) {
  const ui = useTranslations('ui')

  return (
    <div className={cn('relative', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle"
      />
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        spellCheck={false}
        className="min-h-11 w-full rounded-full border-[1.5px] border-sand-300 bg-card ps-11 pe-11 text-sm text-ink transition-colors placeholder:text-ink-subtle focus-visible:border-sea-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={ui('clear')}
          className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-sand-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  )
}
