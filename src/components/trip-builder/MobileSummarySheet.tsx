'use client'

import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { buildHandoffMessage, whatsappLink } from '@/lib/trip-builder/whatsapp'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import type { QuoteView } from '@/lib/trip-builder/view'
import { OverviewTimeline } from './OverviewTimeline'
import { PriceSummary } from './PriceSummary'

/** The mobile "Your trip" bottom sheet — the full price/payment/overview panel, off-canvas. */
export function MobileSummarySheet({
  open,
  onOpenChange,
  state,
  catalog,
  locale,
  quote,
  refreshing,
  errorKey,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: BuilderState
  catalog: BuilderCatalog
  locale: 'ar' | 'en'
  quote: QuoteView | null
  refreshing: boolean
  errorKey: string
}) {
  const t = useTranslations('builder')
  const whatsappHref = catalog.whatsappNumber
    ? whatsappLink(catalog.whatsappNumber, buildHandoffMessage({ state, catalog, locale, total: quote?.total }))
    : undefined

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" closeLabel={t('close')} className="flex max-h-[88vh] flex-col overflow-hidden rounded-t-3xl border-sand-300 bg-sand-50 md:hidden">
        <SheetTitle className="px-5 pt-5 font-display text-lg font-bold text-sea-900">{t('yourTrip')}</SheetTitle>
        <div className="flex-1 space-y-6 overflow-y-auto px-5 pb-6 pt-3">
          <OverviewTimeline state={state} catalog={catalog} locale={locale} />
          <div className="border-t border-sand-200 pt-5">
            <p className="mb-3 font-display text-base font-bold text-sea-900">{t('stepPriceTitle')}</p>
            <PriceSummary quote={quote} refreshing={refreshing} errorKey={errorKey} locale={locale} />
          </div>
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#0f7a3f] text-sm font-semibold text-[#0f7a3f]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('whatsapp')}
            </a>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
