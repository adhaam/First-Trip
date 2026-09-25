'use client'

import { useTranslations } from 'next-intl'
import { MessageCircle } from 'lucide-react'
import { PriceTag } from '@/components/brand/PriceTag'
import { PaymentTerms } from '@/components/brand/PaymentTerms'
import { ButtonLink } from '@/components/ButtonLink'
import type { PaymentPolicy } from '@/lib/payment-rules'

/**
 * The desktop sidebar action card / mobile sticky-bar summary source for a
 * stay's detail page. Purely presentational — every number it shows was
 * computed by the server (fromPricePerPersonPerNight in lib/stays.ts) or is the raw
 * payment policy from the DB (PaymentTerms), never derived here.
 */
export function StayPricingCard({
  fromPrice,
  hasSeasonalRates,
  policies,
  planHref,
  whatsappHref,
}: {
  fromPrice: number
  hasSeasonalRates: boolean
  policies: PaymentPolicy[]
  planHref: string
  whatsappHref: string
}) {
  const t = useTranslations('stays')

  return (
    <div className="space-y-5">
      <div className="overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
        <div className="p-6">
          <PriceTag amount={fromPrice} from unit="personNight" size="lg" />
          <p className="mt-1 text-xs text-ink-subtle">{t('detail.fromContext')}</p>
          <p className="mt-4 text-xs leading-relaxed text-ink-subtle">
            {hasSeasonalRates ? t('detail.seasonalNote') : t('detail.noSeasonalNote')}
          </p>
        </div>

        <div className="border-t border-sand-300 bg-sand-100 px-6 py-4">
          <PaymentTerms kind="stay" policies={policies} compact />
        </div>

        <div className="flex flex-col gap-2.5 p-6 pt-5">
          <ButtonLink href={planHref} variant="sun" size="lg" className="w-full">
            {t('detail.buildStayCta')}
          </ButtonLink>
          <p className="text-center text-xs text-ink-subtle">{t('detail.buildStayHint')}</p>
          <ButtonLink href={whatsappHref} target="_blank" rel="noopener" variant="whatsapp-outline" size="default" className="w-full">
            <MessageCircle className="h-4 w-4" />
            {t('detail.whatsappCta')}
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
