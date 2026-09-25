'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { SlidersHorizontal } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

const triggerClass = cn(
  'inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-sea-900 px-4 text-sm font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50',
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500',
)

/**
 * Filter surface that is two different UIs behind one API and one trigger:
 * a bottom sheet on mobile (secondary config belongs in a sheet, not
 * on-canvas — see "Mobile first" in docs/m2/BRIEF.md) and a compact popover
 * from `md` up, so sorting never pushes a tall panel beside the results.
 */
export function FilterSheet({
  title,
  triggerLabel,
  activeCount,
  onReset,
  children,
  className,
}: {
  title: string
  triggerLabel: string
  activeCount?: number
  onReset?: () => void
  children: ReactNode
  className?: string
}) {
  const ui = useTranslations('ui')
  const [open, setOpen] = useState(false)
  const [desktopOpen, setDesktopOpen] = useState(false)

  const triggerContent = (
    <>
      <SlidersHorizontal className="h-4 w-4" aria-hidden />
      {triggerLabel}
      {!!activeCount && (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sun-500 px-1 text-xs font-bold tabular-nums text-on-accent">
          {activeCount}
        </span>
      )}
    </>
  )

  return (
    <>
      <div className="md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className={cn(triggerClass, className)}>{triggerContent}</SheetTrigger>
          <SheetContent
            side="bottom"
            closeLabel={ui('close')}
            className="flex max-h-[85vh] flex-col overflow-hidden rounded-t-3xl border-sand-300 bg-sand-50"
          >
            <SheetTitle className="px-5 pt-5 font-display text-lg font-bold text-sea-900">
              {title}
            </SheetTitle>
            <div className="flex-1 overflow-y-auto px-5 pb-5 pt-3">{children}</div>
            <div className="safe-bottom flex items-center gap-3 border-t border-sand-200 bg-sand-50 px-5 pt-4">
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="min-h-11 flex-1 rounded-full border-[1.5px] border-sand-300 text-sm font-semibold text-ink-muted transition-colors hover:bg-sand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
                >
                  {ui('clear')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 flex-[2] rounded-full bg-sea-900 text-sm font-semibold text-sand-50 transition-colors hover:bg-sea-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
              >
                {ui('showResults')}
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="hidden md:block">
        <Popover open={desktopOpen} onOpenChange={setDesktopOpen}>
          <PopoverTrigger className={cn(triggerClass, className)}>{triggerContent}</PopoverTrigger>
          <PopoverContent align="end" className="w-72 rounded-2xl border-sand-300 bg-sand-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <PopoverTitle className="font-display text-base font-bold text-sea-900">{title}</PopoverTitle>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-semibold text-ink-subtle underline-offset-4 transition-colors hover:text-sea-900 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-500"
                >
                  {ui('clear')}
                </button>
              )}
            </div>
            <div className="mt-3">{children}</div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  )
}
