'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Loader2, RotateCcw } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { formatDate } from '@/lib/format'
import type { OpsEntityType, WorkItem } from '@/lib/ops/types'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { customerHref, opsItemHref } from '@/components/admin/ops/nav'
import { EntityTypeLabel, NextActionLabel, PaymentPill, StatusPill, useItemTitle } from '@/components/admin/ops/pills'
import { TripRequestPanel } from '@/components/admin/ops/TripRequestPanel'
import { PaymentsPanel, type PaymentExpectation, type PaymentRecord } from '@/components/admin/ops/PaymentsPanel'
import { HistoryTimeline } from '@/components/admin/ops/HistoryTimeline'
import { WorkItemTable } from '@/components/admin/ops/WorkItemTable'

/** Same display reference the work queue shows (ops_work_items, migration 036). */
function displayReference(prefix: 'BK' | 'TB', id: string): string {
  return `${prefix}-${id.slice(0, 8).toUpperCase()}`
}

type ItemResponse = {
  item: WorkItem
  record: Record<string, unknown>
  history: { field: string; from_value: string | null; to_value: string | null; actor: string | null; actor_name: string | null; changed_at: string }[]
  payments: PaymentRecord[]
  audit: { id: string; occurred_at: string; action: string; changes: unknown; actor: string | null; actor_name: string | null }[]
  related: { trip_request: WorkItem | null; items: WorkItem[] }
  customer: { id: string; name: string; phone: string; email: string | null } | null
  payment_expectation: PaymentExpectation
  allowed_statuses: string[]
  payment_allowed: boolean
  can_convert: boolean
}

export function ItemDetail({ type, id }: { type: OpsEntityType; id: string }) {
  const locale = useLocale()
  const titleOf = useItemTitle()
  const t = useTranslations('ops.item')
  const tCommon = useTranslations('ops.common')
  const fetchJson = useOpsFetch()

  const [data, setData] = useState<ItemResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmStatus, setConfirmStatus] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesMessage, setNotesMessage] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [convertResult, setConvertResult] = useState<{ booking_id: string | null; trip_booking_ids: string[] } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res: ItemResponse = await fetchJson(`/api/admin/ops/items/${type}/${id}`)
      setData(res)
      setNotes(typeof res.record.internal_notes === 'string' ? res.record.internal_notes : '')
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(t('loadError'))
    } finally {
      setLoading(false)
    }
  }, [type, id, fetchJson, t])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const changeStatus = async (status: string) => {
    if (!data) return
    setStatusPending(true)
    setStatusError('')
    try {
      const res = await fetchJson(`/api/admin/ops/items/${type}/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, expected_status: data.item.status }),
      })
      // Reload everything: allowed transitions, history, convert/payment
      // availability and the record's updated_at all follow the status.
      setData((current) => current ? { ...current, item: res.item } : current)
      await load()
      setNotice(t('statusChanged'))
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string; payload?: { allowed?: string[]; current_status?: string } }).code : undefined
      const payload = err instanceof Error ? (err as Error & { payload?: { allowed?: string[] } }).payload : undefined
      if (code === 'stale_status') {
        setStatusError(t('statusStale'))
        load()
      } else if (code === 'invalid_transition') {
        setStatusError(t('statusInvalid', { allowed: (payload?.allowed || []).join(', ') }))
      } else {
        setStatusError(tCommon('somethingWrong'))
      }
    } finally {
      setStatusPending(false)
      setConfirmStatus(null)
    }
  }

  const requestStatusChange = (status: string) => {
    if (status === 'cancelled' || status === 'completed') setConfirmStatus(status)
    else changeStatus(status)
  }

  const saveNotes = async () => {
    if (!data) return
    setNotesSaving(true)
    setNotesMessage('')
    try {
      const updatedAt = typeof data.record.updated_at === 'string' ? data.record.updated_at : data.item.updated_at
      const res = await fetchJson(`/api/admin/ops/items/${type}/${id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ internal_notes: notes, expected_updated_at: updatedAt }),
      })
      setData((current) => current
        ? { ...current, record: { ...current.record, internal_notes: res.internal_notes, updated_at: res.updated_at } }
        : current)
      setNotesMessage(t('staffNotesSaved'))
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      if (code === 'stale_record') {
        setNotesMessage(t('staffNotesStale'))
        load()
      } else {
        setNotesMessage(tCommon('somethingWrong'))
      }
    } finally {
      setNotesSaving(false)
    }
  }

  const convert = async () => {
    setConverting(true)
    setConvertError('')
    try {
      const res = await fetchJson(`/api/admin/trip-requests/${id}/convert`, { method: 'POST' })
      setConvertResult({ booking_id: res.booking_id ?? null, trip_booking_ids: res.trip_booking_ids ?? [] })
      load()
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      setConvertError(code && ['request_not_confirmed', 'missing_accommodation', 'missing_quote_snapshot', 'snapshot_mismatch'].includes(code)
        ? t(`convertErrors.${code}`)
        : t('convertError'))
    } finally {
      setConverting(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="flex items-center justify-between gap-4 p-4">
          <p className="text-sm text-red-700">{error}</p>
          <Button variant="outline" size="sm" onClick={load}><RotateCcw className="me-2 h-4 w-4" />{tCommon('retry')}</Button>
        </CardContent>
      </Card>
    )
  }

  if (!data) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>

  const { item } = data

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground"><EntityTypeLabel type={item.entity_type} /></p>
            <h1 className="text-xl font-semibold text-gray-900" dir="ltr">{item.reference}</h1>
            <p className="text-sm text-muted-foreground">{titleOf(item)}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-2"><StatusPill status={item.status} /><PaymentPill paymentStatus={item.payment_status} /></div>
            {item.next_action !== 'none' && (
              <p className="text-sm font-medium text-sea-900"><NextActionLabel action={item.next_action} /></p>
            )}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {item.customer_id ? (
            <Link href={customerHref(item.customer_id)} className="font-medium text-sea-900 hover:underline">{item.customer_name}</Link>
          ) : <span>{item.customer_name}</span>}
          <span dir="ltr">{item.customer_phone}</span>
          <span>{t('source')}: {item.source}</span>
          <span>{t('created')}: {formatDate(item.created_at, locale)}</span>
        </div>
      </div>

      {notice && <p role="status" className="rounded-md bg-green-50 p-2 text-sm text-green-700">{notice}</p>}

      {type === 'trip_request' && <TripRequestPanel record={data.record} />}

      {data.related.items.length > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('confirmedBookingsPanel')}</h2>
          <WorkItemTable items={data.related.items} emptyMessage={t('noRelatedBookings')} />
        </section>
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('statusActions')}</h2>
        {statusError && <p role="alert" className="mb-2 text-sm text-red-700">{statusError}</p>}
        <div className="flex flex-wrap gap-2">
          {data.allowed_statuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant={status === 'cancelled' ? 'destructive' : 'outline'}
              // Darker red keeps the destructive label at WCAG AA contrast on its tinted background.
              className={status === 'cancelled' ? 'text-red-800' : undefined}
              disabled={statusPending}
              onClick={() => requestStatusChange(status)}
            >
              <StatusLabel status={status} />
            </Button>
          ))}
          {data.allowed_statuses.length === 0 && <p className="text-sm text-muted-foreground">{tCommon('none')}</p>}
        </div>

        {data.can_convert && (
          <div className="mt-4 border-t pt-4">
            {convertError && <p role="alert" className="mb-2 text-sm text-red-700">{convertError}</p>}
            {convertResult ? (
              <div className="text-sm">
                <p className="mb-1 font-medium text-green-700">{t('convertedLinks')}</p>
                <ul className="flex flex-col gap-1">
                  {convertResult.booking_id && (
                    <li><Link href={opsItemHref('accommodation_booking', convertResult.booking_id)} className="text-sea-900 hover:underline" dir="ltr">{displayReference('BK', convertResult.booking_id)}</Link></li>
                  )}
                  {convertResult.trip_booking_ids.map((tbId) => (
                    <li key={tbId}><Link href={opsItemHref('trip_booking', tbId)} className="text-sea-900 hover:underline" dir="ltr">{displayReference('TB', tbId)}</Link></li>
                  ))}
                </ul>
              </div>
            ) : (
              <ConvertButton converting={converting} onConvert={convert} />
            )}
          </div>
        )}
      </section>

      {type !== 'trip_request' && (
        <PaymentsPanel
          entityType={type}
          entityId={id}
          expectation={data.payment_expectation}
          payments={data.payments}
          paymentAllowed={data.payment_allowed}
          currentStatus={item.status}
          onChanged={load}
        />
      )}

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('staffNotes')}</h2>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('staffNotesPlaceholder')}
          rows={4}
          aria-label={t('staffNotes')}
        />
        <div className="mt-2 flex items-center gap-3">
          <Button size="sm" onClick={saveNotes} disabled={notesSaving}>
            {notesSaving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {notesSaving ? tCommon('saving') : tCommon('save')}
          </Button>
          {notesMessage && <span className="text-sm text-muted-foreground">{notesMessage}</span>}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('history')}</h2>
        <HistoryTimeline history={data.history} payments={data.payments} audit={data.audit} />
      </section>

      <Dialog open={confirmStatus !== null} onOpenChange={(open) => { if (!open) setConfirmStatus(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmStatus === 'cancelled' ? t('confirmCancel') : t('confirmComplete')}</DialogTitle>
            <DialogDescription>{confirmStatus === 'cancelled' ? t('confirmCancelBody') : t('confirmCompleteBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmStatus(null)}>{tCommon('cancel')}</Button>
            <Button
              variant={confirmStatus === 'cancelled' ? 'destructive' : 'default'}
              disabled={statusPending}
              onClick={() => confirmStatus && changeStatus(confirmStatus)}
            >
              {statusPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {tCommon('confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  const t = useTranslations('ops.status')
  return <>{t.has(status) ? t(status) : status}</>
}

function ConvertButton({ converting, onConvert }: { converting: boolean; onConvert: () => void }) {
  const t = useTranslations('ops.item')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={converting}>
        {converting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
        {converting ? t('converting') : t('convert')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('convertTitle')}</DialogTitle>
            <DialogDescription>{t('convertBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={converting}>
              <CancelLabel />
            </Button>
            <Button
              disabled={converting}
              onClick={() => { setOpen(false); onConvert() }}
            >
              {converting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t('convertConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CancelLabel() {
  const t = useTranslations('ops.common')
  return <>{t('cancel')}</>
}
