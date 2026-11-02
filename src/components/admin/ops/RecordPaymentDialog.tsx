'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { OpsEntityType } from '@/lib/ops/types'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { localInputToIso, toLocalInputValue } from '@/lib/ops/documents-view'

const METHODS = ['vodafonecash', 'instapay', 'cash', 'card_link', 'bank_transfer', 'other'] as const

type PayableEntityType = OpsEntityType

export function RecordPaymentDialog({
  open, onOpenChange, direction, entityType, entityId, currentAmountPaid, onRecorded,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  direction: 'received' | 'refunded'
  entityType: PayableEntityType
  entityId: string
  currentAmountPaid: number
  onRecorded: (result: { amount_paid: number; payment_status: string }) => void
}) {
  const t = useTranslations('ops.payment.dialog')
  const tErr = useTranslations('ops.payment.errors')
  const tCommon = useTranslations('ops.common')
  const tDoc = useTranslations('documents.payments')
  const fetchJson = useOpsFetch()
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [receivedAt, setReceivedAt] = useState(() => toLocalInputValue(new Date()))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recorded, setRecorded] = useState(false)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current) }, [])

  // datetime-local holds the browser's local wall time, so the default must be local too (not UTC).
  const reset = () => { setAmount(''); setReference(''); setNote(''); setError(''); setReceivedAt(toLocalInputValue(new Date())) }

  const submit = async () => {
    const numeric = Number(amount)
    if (!Number.isFinite(numeric) || numeric <= 0) { setError(tErr('invalid_amount')); return }
    setSubmitting(true)
    setError('')
    try {
      const result = await fetchJson('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          direction,
          amount: numeric,
          method,
          expected_amount_paid: currentAmountPaid,
          reference: reference || undefined,
          note: note || undefined,
          received_at: localInputToIso(receivedAt),
        }),
      })
      onRecorded(result)
      reset()
      // Brief confirmation before closing, so the employee sees the payment went through.
      setRecorded(true)
      closeTimer.current = window.setTimeout(() => { setRecorded(false); onOpenChange(false) }, 1200)
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      setError(code && tErr.has(code) ? tErr(code) : tErr('generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) { reset(); setRecorded(false) } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{direction === 'received' ? t('titlePayment') : t('titleRefund')}</DialogTitle>
        </DialogHeader>

        {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {recorded && (
          <p role="status" className="flex items-center gap-2 rounded-md bg-green-50 p-2 text-sm text-green-800">
            <CheckCircle2 className="h-4 w-4" />
            {direction === 'received' ? t('success') : tDoc('refundRecorded')}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="payment-amount">{t('amount')}</Label>
            <Input id="payment-amount" type="number" min="0" step="1" dir="ltr" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1" autoFocus />
          </div>
          <div>
            <Label htmlFor="payment-method">{t('method')}</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as typeof method)}>
              <SelectTrigger id="payment-method" className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => <SelectItem key={m} value={m}><MethodLabel method={m} /></SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="payment-reference">{t('reference')}</Label>
            <Input id="payment-reference" value={reference} onChange={(e) => setReference(e.target.value)} className="mt-1" dir="ltr" />
          </div>
          <div>
            <Label htmlFor="payment-received-at">{t('receivedAt')}</Label>
            <Input id="payment-received-at" type="datetime-local" dir="ltr" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="payment-note">{t('note')}</Label>
            <Textarea id="payment-note" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{recorded ? tCommon('close') : tCommon('cancel')}</Button>
          <Button onClick={submit} disabled={submitting || recorded}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {submitting ? t('submitting') : t('submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MethodLabel({ method }: { method: string }) {
  const t = useTranslations('ops.method')
  return <>{t(method)}</>
}
