import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The fixed contextual CTA for a mobile detail page (price + "Book" /
 * "Add to cart" / "Request"). `≥ md` there's room for the action inline
 * with the page content, so the bar hides itself entirely there — it is
 * a mobile pattern, not a persistent desktop footer.
 *
 * Ships its own in-flow spacer so the fixed bar can never cover the last
 * bit of scrollable content (see "sticky contextual CTA" in the brief).
 */
export function StickyActionBar({
  summary,
  action,
  className,
}: {
  summary?: ReactNode
  action: ReactNode
  className?: string
}) {
  return (
    <>
      <div aria-hidden className="h-24 md:hidden" />
      <div
        data-sticky-action-bar=""
        className={cn(
          'safe-bottom fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t border-sand-300 bg-sand-50/95 px-4 pt-3 shadow-[0_-8px_24px_-12px_rgba(26,27,24,0.25)] backdrop-blur-sm supports-backdrop-filter:bg-sand-50/85 md:hidden',
          className,
        )}
      >
        {summary && <div className="min-w-0 flex-1">{summary}</div>}
        <div className="shrink-0">{action}</div>
      </div>
    </>
  )
}
