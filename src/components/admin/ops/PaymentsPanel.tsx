'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount, formatDate } from '@/lib/format'
import type { OpsEntityType } from '@/lib/ops/types'
import { RecordPaymentDialog } from '@/components/admin/ops/RecordPaymentDialog'

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
  entityType, entityId, expectation, payments, paymentAllowed, currentStatus, onChanged,
}: {
  entityType: Exclude<OpsEntityType, 'trip_request'>
  entityId: string
  expectation: PaymentExpectation
  payments: PaymentRecord[]
  paymentAllowed: boolean
  currentStatus: string
  onChanged: () => void
}) {
  const locale = useLocale()
  const t = useTranslations('ops.payment')
  const tMethod = useTranslations('ops.method')
  const tStatus = useTranslations('ops.status')
  const [dialog, setDialog] = useState<'received' | 'refunded' | null>(null)

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
            value={expectation.balance_amount != null ? formatAmount(expectation.balance_amount, locale) : '—'}
          />
        </dl>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!paymentAllowed} onClick={() => setDialog('received')}>{t('recordPayment')}</Button>
        <Button size="sm" variant="outline" disabled={!paymentAllowed} onClick={() => setDialog('refunded')}>{t('recordRefund')}</Button>
      </div>
      {!paymentAllowed && (
        <p className="mb-3 text-xs text-muted-foreground">{t('notAllowed', { status: tStatus(currentStatus) })}</p>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">{formatDate(payment.received_at, locale)}</TableCell>
                  <TableCell className="text-sm">{payment.direction === 'received' ? t('recordPayment') : t('recordRefund')}</TableCell>
                  <TableCell className="text-sm">{formatAmount(payment.amount, locale)}</TableCell>
                  <TableCell className="text-sm">{tMethod(payment.method)}</TableCell>
                  <TableCell className="text-sm">{payment.reference || '—'}</TableCell>
                  <TableCell className="text-sm">{payment.recorded_by_name || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

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
