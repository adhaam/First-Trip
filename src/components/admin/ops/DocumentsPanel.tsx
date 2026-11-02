'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { formatAmount, formatDate } from '@/lib/format'
import type { WorkItem } from '@/lib/ops/types'
import { documentsMode, isAvailabilityConfirmed, receivedPayments } from '@/lib/ops/documents-view'
import type { PaymentRecord } from '@/components/admin/ops/PaymentsPanel'
import type { DocLocale, DocumentSpec } from '@/components/admin/ops/documentActions'
import { DocLanguageToggle, DocumentActionButtons, DocumentViewerDialog } from '@/components/admin/ops/DocumentControls'

/**
 * The "Customer documents" card of the item screen: Provisional Quotation, Booking Confirmation &
 * Payment Request, and one Payment Receipt per payment received, each with a plain-language note on
 * when to use it. Renders nothing for entity types that issue no customer documents.
 *
 * Props
 * - item: the WorkItem from GET /api/admin/ops/items/[type]/[id]
 * - payments: that payload's `payments` rows (receipts are offered for `direction === 'received'` only)
 * - locale: the admin UI locale ('ar' | 'en'); sets the initial document language
 * - journey: that payload's `journey` (journey_component items only); names the journey to issue from
 */
export function DocumentsPanel({ item, payments, locale, journey }: {
  item: WorkItem
  payments: PaymentRecord[]
  locale: string
  journey?: { id: string; reference: string } | null
}) {
  const t = useTranslations('documents')
  const tMethod = useTranslations('ops.method')
  const tCommon = useTranslations('ops.common')
  const tStatus = useTranslations('ops.status')
  const [docLocale, setDocLocale] = useState<DocLocale>(locale === 'en' ? 'en' : 'ar')
  const [viewing, setViewing] = useState<{ spec: DocumentSpec; title: string } | null>(null)

  const mode = documentsMode(item)
  if (mode === 'none') return null

  if (mode === 'component') {
    return (
      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-muted-foreground">
          {journey?.reference ? t('componentNote', { reference: journey.reference }) : t('componentNoteNoRef')}
        </p>
      </section>
    )
  }

  const quotationSpec: DocumentSpec = mode === 'journey'
    ? { kind: 'quotation', requestId: item.entity_id, reference: item.reference }
    : {
        kind: 'booking',
        bookingId: item.entity_id,
        bookingType: item.entity_type === 'trip_booking' ? 'trip' : 'accommodation',
        type: 'provisional_quotation',
        reference: item.reference,
      }
  const confirmationSpec: DocumentSpec = mode === 'journey'
    ? { kind: 'confirmation', requestId: item.entity_id, reference: item.reference }
    : { ...(quotationSpec as Extract<DocumentSpec, { kind: 'booking' }>), type: 'booking_confirmation' }

  const confirmationReady = isAvailabilityConfirmed(item.status)
  const received = receivedPayments(payments)
  const statusLabel = tStatus.has(item.status) ? tStatus(item.status) : item.status

  const view = (spec: DocumentSpec, name: string) => setViewing({ spec, title: `${name} · ${item.reference}` })

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <DocLanguageToggle value={docLocale} onChange={setDocLocale} />
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t('intro')}</p>

      <ol className="flex flex-col divide-y">
        <li className="flex flex-col gap-2 py-3 first:pt-0">
          <div>
            <p className="text-sm font-semibold">{t('names.provisionalQuotation')}</p>
            <p className="text-xs text-muted-foreground">{t('when.provisionalQuotation')}</p>
          </div>
          <DocumentActionButtons
            spec={quotationSpec}
            docLocale={docLocale}
            onView={(spec) => view(spec, t('names.provisionalQuotation'))}
          />
        </li>

        <li className="flex flex-col gap-2 py-3">
          <div>
            <p className="text-sm font-semibold">{t('names.bookingConfirmation')}</p>
            <p className="text-xs text-muted-foreground">{t('when.bookingConfirmation')}</p>
          </div>
          {!confirmationReady && (
            <p className="text-xs text-amber-800">
              {t('confirmationLocked')} {t('payments.currentStatus', { status: statusLabel })}
            </p>
          )}
          <DocumentActionButtons
            spec={confirmationSpec}
            docLocale={docLocale}
            disabled={!confirmationReady}
            onView={(spec) => view(spec, t('names.bookingConfirmation'))}
          />
        </li>

        <li className="flex flex-col gap-2 py-3 last:pb-0">
          <div>
            <p className="text-sm font-semibold">{t('names.paymentReceipt')}</p>
            <p className="text-xs text-muted-foreground">{t('when.paymentReceipt')}</p>
          </div>
          {received.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('receipts.empty')}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {received.map((payment) => (
                <li key={payment.id} className="flex flex-col gap-1 rounded-md border bg-gray-50/60 p-2">
                  <p className="text-sm">
                    <span>{formatDate(payment.received_at, locale)}</span>
                    {' · '}
                    <span dir="ltr" className="whitespace-nowrap tabular-nums">
                      {formatAmount(payment.amount, locale)} {tCommon('egp')}
                    </span>
                    {' · '}
                    <span>{tMethod.has(payment.method) ? tMethod(payment.method) : payment.method}</span>
                  </p>
                  <DocumentActionButtons
                    spec={{ kind: 'receipt', paymentId: payment.id, reference: item.reference }}
                    docLocale={docLocale}
                    onView={(spec) => view(spec, t('names.paymentReceipt'))}
                  />
                </li>
              ))}
            </ul>
          )}
        </li>
      </ol>

      <DocumentViewerDialog
        spec={viewing?.spec ?? null}
        title={viewing?.title ?? ''}
        docLocale={docLocale}
        onDocLocaleChange={setDocLocale}
        onClose={() => setViewing(null)}
      />
    </section>
  )
}
