'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ArrowRight, Info, Loader2, RotateCcw } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { formatAmount, formatDate } from '@/lib/format'
import type { OpsEntityType, WorkItem } from '@/lib/ops/types'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { customerHref, opsItemHref } from '@/components/admin/ops/nav'
import { EntityTypeLabel, JourneyBadge, PaymentPill, StatusPill, useItemTitle } from '@/components/admin/ops/pills'
import { TripRequestPanel } from '@/components/admin/ops/TripRequestPanel'
import { PaymentsPanel, type PaymentExpectation, type PaymentRecord } from '@/components/admin/ops/PaymentsPanel'
import { HistoryTimeline } from '@/components/admin/ops/HistoryTimeline'
import { AmendJourneyAction, type AmendResult } from '@/components/admin/ops/AmendJourneyDialog'
import { RevisionsPanel } from '@/components/admin/ops/RevisionsPanel'
import { DocumentsPanel } from '@/components/admin/ops/DocumentsPanel'
import { WorkItemTable } from '@/components/admin/ops/WorkItemTable'
import { resolveItemActions, type StatusAction, type StatusConfirmKind } from '@/lib/ops/primary-action'

/** DOM id the payments panel wrapper carries, so the primary action can scroll to and focus it. */
const PAYMENTS_PANEL_ID = 'ops-payments-panel'

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
  refund_allowed?: boolean
  can_convert: boolean
  /** trip_request only: children created by conversion (payment_allowed is always false on these). */
  components?: WorkItem[]
  /** journey_component items only: the parent trip_request this item belongs to. */
  journey?: { id: string; reference: string } | null
}

/** Derives the staff-facing kind label key for a journey component row. */
function componentKindKey(item: Pick<WorkItem, 'entity_type' | 'subtype'>): string {
  if (item.entity_type === 'accommodation_booking') {
    if (item.subtype === 'transfer-only') return 'transport'
    if (item.subtype === 'package') return 'stayTransport'
    return 'stay'
  }
  if (item.entity_type === 'trip_booking') {
    if (item.subtype === 'package') return 'package'
    return 'trip'
  }
  return 'stay'
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
  const [confirm, setConfirm] = useState<{ status: string; kind: StatusConfirmKind } | null>(null)
  const [statusPending, setStatusPending] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesMessage, setNotesMessage] = useState('')
  const [converting, setConverting] = useState(false)
  const [convertError, setConvertError] = useState('')
  const [convertResult, setConvertResult] = useState<{ booking_id: string | null; trip_booking_ids: string[] } | null>(null)
  const [revisionsKey, setRevisionsKey] = useState(0)
  const tAmend = useTranslations('ops.amend')
  const tPayment = useTranslations('ops.payment')
  const tStatus = useTranslations('ops.status')

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
      } else if (code === 'component_of_journey') {
        setStatusError(t('statusComponent'))
        load()
      } else if (code === 'invalid_transition') {
        setStatusError(t('statusInvalid', { allowed: (payload?.allowed || []).join(', ') }))
      } else {
        setStatusError(tCommon('somethingWrong'))
      }
    } finally {
      setStatusPending(false)
      setConfirm(null)
    }
  }

  const onAmended = (result: AmendResult) => {
    setRevisionsKey((key) => key + 1)
    setNotice(tAmend('success', { n: result.revision_number }))
    load()
  }

  const requestStatusChange = (action: StatusAction) => {
    if (action.confirm) setConfirm({ status: action.status, kind: action.confirm })
    else changeStatus(action.status)
  }

  const onPaymentChanged = () => {
    load()
    setNotice(tPayment('dialog.success'))
  }

  const paymentsPanelRef = useRef<HTMLDivElement>(null)
  const focusPayments = () => {
    const panel = paymentsPanelRef.current
    if (!panel) return
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' })
    panel.focus({ preventScroll: true })
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
  // A trips-only journey converts without a bookings row, so converted_booking_id stays NULL.
  const isConverted = item.converted || Boolean(data.record.converted_at) || Boolean(data.record.converted_booking_id)
  const isComponent = item.journey_component
  const paymentsShown = !isComponent && item.next_action !== 'reconcile_payments' && (type !== 'trip_request' || isConverted)
  const actions = resolveItemActions({
    entityType: type,
    status: item.status,
    nextAction: item.next_action,
    allowedStatuses: data.allowed_statuses,
    journeyComponent: isComponent,
    canConvert: data.can_convert,
    paymentsVisible: paymentsShown,
  })
  const { primary } = actions
  const updatedAt = typeof data.record.updated_at === 'string' ? data.record.updated_at : item.updated_at
  const amendControl = (prominent: boolean) => (
    <AmendJourneyAction
      requestId={id}
      status={item.status}
      updatedAt={updatedAt}
      onAmended={onAmended}
      onStale={load}
      prominent={prominent}
    />
  )
  const hasOtherActions = actions.secondary.length > 0 || actions.amend === 'secondary' || actions.convert === 'secondary'
  const relatedHeading = isComponent ? t('relatedInJourney') : t('relatedFromRequest')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {type === 'trip_request'
                ? t(isConverted ? 'kind.journey' : 'kind.tripRequest')
                : isComponent ? t('kind.booking') : <EntityTypeLabel type={item.entity_type} />}
            </p>
            <h1 className="text-xl font-semibold text-gray-900" dir="ltr">{item.reference}</h1>
            <p className="text-sm text-muted-foreground">{titleOf(item)}</p>
          </div>
          <div className="flex max-w-sm flex-col items-end gap-1 text-end">
            <div className="flex items-center gap-2">
              <StatusPill status={item.status} />
              {/* A journey booking's own payment columns are frozen; its money is on the journey. */}
              {isComponent
                ? <span className="text-xs text-muted-foreground">{t('paidViaJourney')}</span>
                : <PaymentPill paymentStatus={item.payment_status} />}
            </div>
            {!isComponent && (
              <p className="text-sm text-muted-foreground">{t(`nextHint.${item.next_action}`)}</p>
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

      {isComponent && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-sea-900/30 bg-sea-50 p-4">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm font-medium text-sea-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {data.journey
                ? t.rich('componentBanner', {
                  reference: () => <span dir="ltr" className="font-semibold">{data.journey!.reference}</span>,
                })
                : t('componentBannerNoLink')}
            </span>
          </p>
          {data.journey && (
            <Link
              href={opsItemHref('trip_request', data.journey.id)}
              className={buttonVariants({ size: 'touch' })}
            >
              {t('openJourney')}
              <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
          )}
        </section>
      )}

      {type === 'trip_request' && <TripRequestPanel record={data.record} />}

      {/* A converted journey lists its bookings once, in the components panel below — not twice. */}
      {data.related.items.length > 0 && !(type === 'trip_request' && isConverted && (data.components?.length ?? 0) > 0) && (
        <section className="rounded-lg border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">{relatedHeading}</h2>
          <WorkItemTable items={data.related.items} emptyMessage={t('noRelatedBookings')} />
        </section>
      )}

      {type === 'trip_request' && isConverted && (data.components?.length ?? 0) > 0 && (
        <section className="rounded-lg border bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">{t('componentsPanel')}</h2>
            <JourneyBadge />
          </div>
          <div className="flex flex-col divide-y">
            {(data.components ?? []).map((component) => (
              <div key={`${component.entity_type}:${component.entity_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0">
                  <Link href={opsItemHref(component.entity_type, component.entity_id)} className="font-medium text-sea-900 hover:underline" dir="ltr">
                    {component.reference}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    <ComponentKindLabel item={component} />
                    {component.start_date ? ` · ${formatDate(component.start_date, locale)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill status={component.status} />
                  {component.amount_total != null && (
                    <span className="text-sm text-muted-foreground">{formatAmount(component.amount_total, locale)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(!isComponent || hasOtherActions) && (
        <section className="rounded-lg border bg-white p-4" aria-labelledby="ops-item-next-step">
          <h2 id="ops-item-next-step" className="mb-3 text-sm font-semibold text-gray-900">{t('nextStep')}</h2>
          {statusError && <p role="alert" className="mb-2 text-sm text-red-700">{statusError}</p>}

          <div className="flex flex-col gap-2">
            {primary.kind === 'status' && (
              <div>
                <Button size="touch" disabled={statusPending} onClick={() => requestStatusChange(primary.action)}>
                  {statusPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                  {t(`statusAction.${primary.labelKey}`)}
                </Button>
              </div>
            )}
            {primary.kind === 'amend' && amendControl(true)}
            {primary.kind === 'payments' && (
              <div>
                <Button size="touch" onClick={focusPayments}>{t(`primaryAction.${primary.labelKey}`)}</Button>
              </div>
            )}
            {primary.kind === 'convert' && (
              <ConvertControl converting={converting} convertError={convertError} onConvert={convert} prominent />
            )}
            {primary.kind === 'none' && (
              <div>
                <p className="text-sm font-medium text-gray-900">{t('nothingToDo')}</p>
                <p className="text-sm text-muted-foreground">{t(`noneReason.${primary.reason}`)}</p>
              </div>
            )}
            {convertResult && <ConvertedLinks result={convertResult} />}
          </div>

          {hasOtherActions && (
            <div className="mt-4 border-t pt-4">
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('otherActions')}</h3>
              <div className="flex flex-wrap items-start gap-2">
                {actions.amend === 'secondary' && amendControl(false)}
                {actions.convert === 'secondary' && (
                  <ConvertControl converting={converting} convertError={convertError} onConvert={convert} />
                )}
                {actions.secondary.map((action) => (
                  <Button
                    key={action.status}
                    size="sm"
                    variant={action.destructive ? 'destructive' : 'outline'}
                    // Darker red keeps the destructive label at WCAG AA contrast on its tinted background.
                    className={action.destructive ? 'text-red-800' : undefined}
                    disabled={statusPending}
                    onClick={() => requestStatusChange(action)}
                  >
                    {t(`statusAction.${action.labelKey}`)}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {item.next_action === 'reconcile_payments' && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900">{t('reconcilePaymentsWarning')}</p>
        </section>
      )}

      {paymentsShown && (
        <div
          id={PAYMENTS_PANEL_ID}
          ref={paymentsPanelRef}
          tabIndex={-1}
          className="scroll-mt-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-sea-900/40"
        >
          <PaymentsPanel
            entityType={type}
            entityId={id}
            expectation={data.payment_expectation}
            payments={data.payments}
            paymentAllowed={data.payment_allowed}
            refundAllowed={data.refund_allowed}
            currentStatus={item.status}
            converted={item.converted}
            reference={item.reference}
            onChanged={onPaymentChanged}
          />
        </div>
      )}
      {type === 'trip_request' && !isConverted && (
        <p className="rounded-lg border border-dashed bg-white p-4 text-sm text-muted-foreground">{t('paymentsOnJourney')}</p>
      )}
      <DocumentsPanel item={item} payments={data.payments} locale={locale} journey={data.journey} />

      {type === 'trip_request' && (
        <RevisionsPanel requestId={id} reference={item.reference} refreshKey={revisionsKey} />
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

      <Dialog open={confirm !== null} onOpenChange={(open) => { if (!open) setConfirm(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? t(CONFIRM_COPY[confirm.kind].title) : ''}</DialogTitle>
            <DialogDescription>
              {confirm ? t(CONFIRM_COPY[confirm.kind].body, { status: tStatus.has(confirm.status) ? tStatus(confirm.status) : confirm.status }) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>{tCommon('cancel')}</Button>
            <Button
              variant={confirm?.kind === 'cancel' ? 'destructive' : 'default'}
              disabled={statusPending}
              onClick={() => confirm && changeStatus(confirm.status)}
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

/** Dialog wording per confirmation kind (keys under ops.item). */
const CONFIRM_COPY: Record<StatusConfirmKind, { title: string; body: string }> = {
  cancel: { title: 'confirmCancel', body: 'confirmCancelBody' },
  complete: { title: 'confirmComplete', body: 'confirmCompleteBody' },
  reopen: { title: 'confirmReopen', body: 'confirmReopenBody' },
  alternative: { title: 'confirmAlternative', body: 'confirmAlternativeBody' },
}

function ComponentKindLabel({ item }: { item: Pick<WorkItem, 'entity_type' | 'subtype'> }) {
  const t = useTranslations('ops.item.componentKind')
  return <>{t(componentKindKey(item))}</>
}

function ConvertedLinks({ result }: { result: { booking_id: string | null; trip_booking_ids: string[] } }) {
  const t = useTranslations('ops.item')
  const hasLinks = Boolean(result.booking_id) || result.trip_booking_ids.length > 0
  return (
    <div className="text-sm">
      <p className="mb-1 font-medium text-green-700">{hasLinks ? t('convertedLinks') : t('convertedTripsOnly')}</p>
      <ul className="flex flex-col gap-1">
        {result.booking_id && (
          <li><Link href={opsItemHref('accommodation_booking', result.booking_id)} className="text-sea-900 hover:underline" dir="ltr">{displayReference('BK', result.booking_id)}</Link></li>
        )}
        {result.trip_booking_ids.map((tbId) => (
          <li key={tbId}><Link href={opsItemHref('trip_booking', tbId)} className="text-sea-900 hover:underline" dir="ltr">{displayReference('TB', tbId)}</Link></li>
        ))}
      </ul>
    </div>
  )
}

function ConvertControl({ converting, convertError, onConvert, prominent }: {
  converting: boolean
  convertError: string
  onConvert: () => void
  prominent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      {convertError && <p role="alert" className="text-sm text-red-700">{convertError}</p>}
      <ConvertButton converting={converting} onConvert={onConvert} prominent={prominent} />
    </div>
  )
}

function ConvertButton({ converting, onConvert, prominent }: { converting: boolean; onConvert: () => void; prominent?: boolean }) {
  const t = useTranslations('ops.item')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        size={prominent ? 'touch' : 'sm'}
        variant={prominent ? 'default' : 'outline'}
        onClick={() => setOpen(true)}
        disabled={converting}
      >
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
