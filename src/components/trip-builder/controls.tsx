'use client'

import { type KeyboardEvent, type ReactNode, useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Small, dumb building blocks shared by the journey step components. None of
 * these know about `BuilderState` or the reducer — they take primitive
 * values and callbacks, so each step component stays the thing that knows
 * what a change means.
 */

export const fieldClass =
  'mt-2 min-h-11 w-full rounded-xl border border-sand-300 bg-white px-3.5 text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600'

/** A single choice within a `role="radiogroup"` — arrow-key navigable, 44px+ target. */
export function ChoiceCard({
  active,
  title,
  detail,
  meta,
  onClick,
  className,
}: {
  active: boolean
  title: ReactNode
  detail?: ReactNode
  meta?: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={cn(
        'min-h-24 rounded-2xl border-[1.5px] p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600',
        active ? 'border-sun-600 bg-sun-50 ring-1 ring-sun-200' : 'border-sand-300 bg-white hover:border-sea-900/40',
        className,
      )}
    >
      <span className="block font-display text-base font-bold text-sea-900">{title}</span>
      {detail && <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{detail}</span>}
      {meta && <span className="mt-2 block text-xs font-semibold text-sun-700">{meta}</span>}
    </button>
  )
}

/** Roving-tabindex arrow-key handler for a `role="radiogroup"` of `ChoiceCard`s. */
export function handleRadioGroupKeyDown(event: KeyboardEvent<HTMLDivElement>) {
  if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return
  const group = event.currentTarget
  const items = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  if (!items.length) return
  const currentIndex = Math.max(0, items.findIndex((item) => item === document.activeElement))
  const rtl = getComputedStyle(group).direction === 'rtl'
  const forward = event.key === 'ArrowDown' || (rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight')
  const backward = event.key === 'ArrowUp' || (rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft')
  if (!forward && !backward) return
  event.preventDefault()
  const nextIndex = (currentIndex + (forward ? 1 : -1) + items.length) % items.length
  items[nextIndex]?.focus()
  items[nextIndex]?.click()
}

/** A labelled +/- counter, e.g. adults, children, room counts. */
export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  locale,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max?: number
  locale: 'ar' | 'en'
  onChange: (value: number) => void
}) {
  const labelId = useId()
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-sand-100 px-3.5 py-2.5">
      <div className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold text-sea-900">{label}</span>
        {hint && <span className="block text-xs text-ink-subtle">{hint}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          aria-label={`${label} −`}
          aria-labelledby={labelId}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className="grid size-10 place-items-center rounded-full border border-sand-300 bg-white text-sea-900 transition-opacity disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
        >
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="min-w-6 text-center text-sm font-bold tabular-nums text-sea-900" aria-live="polite">
          {formatNumber(value, locale)}
        </span>
        <button
          type="button"
          aria-label={`${label} +`}
          aria-labelledby={labelId}
          disabled={max != null && value >= max}
          onClick={() => onChange(max != null ? Math.min(max, value + 1) : value + 1)}
          className="grid size-10 place-items-center rounded-full bg-sea-900 text-sand-50 transition-opacity disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-600"
        >
          <Plus className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

export function TextField({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  error,
  required,
  autoComplete,
}: {
  label: string
  type?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  autoComplete?: string
}) {
  const id = useId()
  const errorId = `${id}-error`
  return (
    <label className="block text-sm font-semibold text-sea-900" htmlFor={id}>
      {label}
      {required && <span aria-hidden className="text-sun-700"> *</span>}
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={cn(fieldClass, error && 'border-red-400 focus-visible:outline-red-500')}
      />
      {error && <span id={errorId} role="alert" className="mt-1.5 block text-xs font-medium text-red-700">{error}</span>}
    </label>
  )
}
