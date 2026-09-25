'use client'

import { useTranslations } from 'next-intl'
import { Check, MessageCircle } from 'lucide-react'
import { Section } from '@/components/brand'
import { formatAmount, formatReference } from '@/lib/format'
import { buildHandoffMessage, whatsappLink } from '@/lib/trip-builder/whatsapp'
import type { BuilderCatalog, BuilderState } from '@/lib/trip-builder/types'
import type { PaymentPlan } from '@/lib/payment-rules'

export type SubmitSuccess = { reference?: string; total?: number; parts?: { kind: PaymentPlan['kind']; total: number; plan: PaymentPlan }[] }

/** Shown after a successful `POST /api/trip-requests` — the draft has already been cleared. */
export function SuccessState({
  catalog,
  state,
  locale,
  success,
  onReset,
}: {
  catalog: BuilderCatalog
  state: BuilderState
  locale: 'ar' | 'en'
  success: SubmitSuccess
  onReset: () => void
}) {
  const t = useTranslations('builder')
  const common = useTranslations('common')
  const whatsappHref = catalog.whatsappNumber
    ? whatsappLink(catalog.whatsappNumber, buildHandoffMessage({ state, catalog, locale, reference: success.reference, total: success.total }))
    : undefined

  return (
    <Section size="lg">
      <div className="container-main max-w-xl">
        <div className="rounded-3xl border-[1.5px] border-sand-300 bg-white p-7 text-center sm:p-9">
          <span aria-hidden className="mx-auto grid size-14 place-items-center rounded-full bg-sun-500 text-on-accent">
            <Check className="h-7 w-7" />
          </span>
          <h1 className="mt-5 font-display text-3xl font-bold text-sea-900">{t('requestSent')}</h1>
          <p className="mt-2.5 text-ink-muted">{t('requestSentHint')}</p>

          {success.reference && (
            <div className="mt-6 rounded-2xl bg-sand-100 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('reference')}</p>
              <p className="mt-1 font-display text-xl font-bold tabular-nums text-sea-900">{formatReference(success.reference)}</p>
              {success.total != null && (
                <p className="mt-1 text-sm text-ink-muted">
                  {t('quotedTotal')}: {formatAmount(success.total, locale)} {common('egp')}
                </p>
              )}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#128c4a] text-sm font-semibold text-[#128c4a] transition-colors hover:bg-[#128c4a]/5"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t('whatsapp')}
              </a>
            )}
            <button type="button" onClick={onReset} className="min-h-12 w-full rounded-full bg-sea-900 text-sm font-semibold text-sand-50 transition-colors hover:bg-sea-800">
              {t('startOver')}
            </button>
          </div>
        </div>
      </div>
    </Section>
  )
}
