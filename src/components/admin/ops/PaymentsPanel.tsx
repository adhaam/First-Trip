'use client'

import { useState } from 'react'
import { FileText } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount, formatDate } from '@/lib/format'
import type { OpsEntityType } from '@/lib/ops/types'
import { paymentBlockReason } from '@/lib/ops/documents-view'
import { computePaymentDue } from '@/lib/documents/payment-due'
import { RecordPaymentDialog } from '@/components/admin/ops/RecordPaymentDialog'
import { DocumentViewerDialog } from '@/components/admin/ops/DocumentControls'
import type { DocLocale, DocumentSpec } from '@/components/admin/ops/documentActions'

export type PaymentExpectation = {
  kind: string | null
  total: number | null
  upfront_percent: number | null
  upfront_amount: number | null
  balance_amount: number | null
  balance_due: 'on_arrival' | 'before_service' | null
  amount_paid: number
  outstanding_now: number | null
  outstanding_total: number | null
} | null

export type PaymentRecord = {
  id: string
  direction: 'received' | 'refunded'
  amount: number
  method: string
  reference: string | null
  note: string | null
  received_at: string
  recorded_by: string | null
  recorded_by_name: string | null
  amount_paid_after: number
}

export function PaymentsPanel({
  entityType, entityId, expectation, payments, paymentAllowed, refundAllowed = paymentAllowed, currentStatus, converted, reference, onChanged,
}: {
  entityType: OpsEntityType
  entityId: string
  expectation: PaymentExpectation
  payments: PaymentRecord[]
  paymentAllowed: boolean
  /** Refunds follow their own rule (money held, any status — see refundAllowedFor). */
  refundAllowed?: boolean
  currentStatus: string
  /** trip_request only: false while the Trip Builder request has not been converted yet (explains why payments are blocked). */
  converted?: boolean
  /** Item reference (BK-/TB-/WR-...), used to name receipt downloads. */
  reference?: string
  onChanged: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('ops.payment')
  const tMethod = useTranslations('ops.method')
  const tStatus = useTranslations('ops.status')
  const tDoc = useTranslations('documents')
  const tCommon = useTranslations('ops.common')
  const [dialog, setDialog] = useState<'received' | 'refunded' | null>(null)
  const [receipt, setReceipt] = useState<DocumentSpec | null>(null)
  const [docLocale, setDocLocale] = useState<DocLocale>(locale === 'en' ? 'en' : 'ar')
  const blockReason = paymentAllowed ? null : paymentBlockReason({ entityType, status: currentStatus, converted })
  // What is still owed later, after what is due now — the same subtraction the customer documents
  // make (not the plan's original split, which ignored money already received).
  const dueLater = expectation?.total != null && expectation.upfront_amount != null
    ? computePaymentDue({
      total: expectation.total,
      amountPaid: expectation.amount_paid,
      plan: { rule: 'policy', upfrontAmount: expectation.upfront_amount, upfrontPercent: expectation.upfront_percent ?? null, balanceDue: null },
    }).dueLater
    : null

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('title')}</h2>

      {expectation && (
        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <Field label={t('total')} value={expectation.total != null ? `${formatAmount(expectation.total, locale)}` : '—'} />
          <Field label={t('paid')} value={formatAmount(expectation.amount_paid, locale)} />
          <Field
            label={t('outstandingNow')}
            value={expectation.outstanding_now != null ? formatAmount(expectation.outstanding_now, locale) : '—'}
          />
          <Field
            label={expectation.balance_due === 'on_arrival' ? t('dueOnArrival') : t('dueBeforeService')}
            value={dueLater != null ? formatAmount(dueLater, locale) : '—'}
          />
        </dl>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!paymentAllowed} onClick={() => setDialog('received')}>{t('recordPayment')}</Button>
        <Button size="sm" variant="outline" disabled={!refundAllowed} onClick={() => setDialog('refunded')}>{t('recordRefund')}</Button>
      </div>
      {!paymentAllowed && (
        <p className="mb-3 text-xs text-muted-foreground">
          {blockReason
            ? tDoc(`payments.blocked.${blockReason}`)
            : entityType === 'trip_request'
              ? t('errors.journey_not_commercial')
              : t('notAllowed', { status: tStatus.has(currentStatus) ? tStatus(currentStatus) : currentStatus })}
          {blockReason && ` ${tDoc('payments.currentStatus', { status: tStatus.has(currentStatus) ? tStatus(currentStatus) : currentStatus })}`}
        </p>
      )}

      {payments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('ledgerEmpty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('date')}</TableHead>
                <TableHead>{t('direction')}</TableHead>
                <TableHead>{t('amount')}</TableHead>
                <TableHead>{t('method')}</TableHead>
                <TableHead>{t('reference')}</TableHead>
                <TableHead>{t('recordedBy')}</TableHead>
                <TableHead><span className="sr-only">{tDoc('payments.receipt')}</span></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">{formatDate(payment.received_at, locale)}</TableCell>
                  <TableCell className="text-sm">{payment.direction === 'received' ? tDoc('payments.typeReceived') : tDoc('payments.typeRefund')}</TableCell>
                  <TableCell className="text-sm">{formatAmount(payment.amount, locale)}</TableCell>
                  <TableCell className="text-sm">{tMethod(payment.method)}</TableCell>
                  <TableCell className="text-sm">{payment.reference || '—'}</TableCell>
                  <TableCell className="text-sm">{payment.recorded_by_name || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {payment.direction === 'received' && (
                      <Button
                        size="xs"
                        variant="outline"
                        aria-label={tDoc('payments.receiptAria', { amount: `${formatAmount(payment.amount, locale)} ${tCommon('egp')}` })}
                        onClick={() => setReceipt({ kind: 'receipt', paymentId: payment.id, reference: reference ?? entityId })}
                      >
                        <FileText className="me-1" />
                        {tDoc('payments.receipt')}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <DocumentViewerDialog
        spec={receipt}
        title={tDoc('names.paymentReceipt')}
        docLocale={docLocale}
        onDocLocaleChange={setDocLocale}
        onClose={() => setReceipt(null)}
      />

      {dialog && (
        <RecordPaymentDialog
          open
          onOpenChange={(open) => { if (!open) setDialog(null) }}
          direction={dialog}
          entityType={entityType}
          entityId={entityId}
          currentAmountPaid={expectation?.amount_paid ?? 0}
          onRecorded={onChanged}
        />
      )}
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  )
}
