'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Minus, Pencil, Plus, RotateCcw, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { formatAmount, formatCount, formatDate } from '@/lib/format'
import { patternsForMode } from '@/lib/trip-builder/dates'
import type { BuilderCatalog } from '@/lib/trip-builder/types'
import type { RoomPlanView } from '@/lib/trip-builder/view'
import type { TransportMode } from '@/lib/trip-requests/schema'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { cn } from '@/lib/utils'

type RoomType = 'single' | 'double' | 'triple'
type RoomCounts = Record<RoomType, number>

const ROOM_TYPES: RoomType[] = ['single', 'double', 'triple']
const TRANSPORT_MODES: TransportMode[] = ['package_bus', 'hiace', 'stay_only']
const MAX_EXPERIENCES = 10
const MAX_REASON = 500

export type AmendExperience = { kind: 'trip' | 'trip_package'; id: string; preferred_date?: string }

export type AmendJourney = {
  transport_mode: TransportMode
  origin_governorate_code?: string
  stay_pattern_code?: string
  arrival_date: string
  departure_date?: string
  adults: number
  children: number
  accommodation_id?: string
  room_allocations?: { type: RoomType; count: number; upgrade_id?: string }[]
  meal_plan_key?: string
  upgrade_id?: string
  experiences: AmendExperience[]
}

export type AmendBlocker = null | 'amendment_closed' | 'amendment_paid_journey'

export type AmendData = {
  request: {
    id: string
    reference: string
    status: string
    updated_at: string
    converted: boolean
    amount_paid: number
    agreed_total: number | null
    quoted_total: number | null
    customer_name: string
    journey: AmendJourney
  }
  blocker: AmendBlocker
  catalog: BuilderCatalog
}

export type AmendResult = {
  revision_number: number
  previous_total: number
  new_total: number
  difference: number
  status: string
  converted: boolean
}

type QuoteLine = { key: string; label_en: string; label_ar: string; amount: number }

type PreviewResult = {
  original: { total: number; lines: QuoteLine[] }
  revised: {
    total: number
    lines: QuoteLine[]
    payment?: {
      upfrontAmount: number | null
      balanceAmount: number | null
      balanceDue?: 'on_arrival' | 'before_service' | null
    }
    rooms?: RoomPlanView
    dates?: { arrivalDate: string; departureDate: string; nights: number; durationDays: number }
  }
  difference: number
  availability_reset: boolean
  blocker: AmendBlocker
}

type Form = {
  transport_mode: TransportMode
  origin: string
  pattern: string
  arrival: string
  departure: string
  adults: number
  children: number
  accommodation: string
  meal: string
  upgrade: string
  /** null = let the server recommend the cheapest valid combination. */
  rooms: RoomCounts | null
  experiences: AmendExperience[]
}

const WARN_CLASS = 'rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900'
const ERROR_CLASS = 'rounded-md bg-red-50 p-2 text-sm text-red-700'
const SELECT_CLASS = 'h-11 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none '
  + 'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm'

function countsOf(allocations: AmendJourney['room_allocations']): RoomCounts {
  const counts: RoomCounts = { single: 0, double: 0, triple: 0 }
  for (const allocation of allocations ?? []) counts[allocation.type] += allocation.count
  return counts
}

function initialForm(journey: AmendJourney): Form {
  return {
    transport_mode: journey.transport_mode,
    origin: journey.origin_governorate_code ?? '',
    pattern: journey.stay_pattern_code ?? '',
    arrival: journey.arrival_date ?? '',
    departure: journey.departure_date ?? '',
    adults: journey.adults ?? 1,
    children: journey.children ?? 0,
    accommodation: journey.accommodation_id ?? '',
    meal: journey.meal_plan_key ?? '',
    upgrade: journey.upgrade_id ?? '',
    rooms: null,
    experiences: (journey.experiences ?? []).map((experience) => ({ ...experience })),
  }
}

/** Shapes the form into the journey payload the amend endpoints expect. */
function buildJourney(form: Form, original: AmendJourney): AmendJourney {
  const mode = form.transport_mode
  const journey: AmendJourney = {
    transport_mode: mode,
    arrival_date: form.arrival,
    adults: form.adults,
    children: form.children,
    experiences: form.experiences.map((experience) => ({
      kind: experience.kind,
      id: experience.id,
      ...(experience.preferred_date ? { preferred_date: experience.preferred_date } : {}),
    })),
  }
  if (mode !== 'stay_only' && form.origin) journey.origin_governorate_code = form.origin
  if (mode !== 'stay_only' && form.pattern) journey.stay_pattern_code = form.pattern
  const needsDeparture = mode === 'stay_only' || (mode === 'hiace' && !form.pattern)
  if (needsDeparture && form.departure) journey.departure_date = form.departure
  if (!form.accommodation) return journey

  journey.accommodation_id = form.accommodation
  if (form.meal) journey.meal_plan_key = form.meal
  if (form.upgrade) journey.upgrade_id = form.upgrade
  if (form.rooms) {
    const sameStay = original.accommodation_id === form.accommodation
    journey.room_allocations = ROOM_TYPES
      .filter((type) => form.rooms![type] > 0)
      .map((type) => {
        const kept = sameStay && !form.upgrade
          ? original.room_allocations?.find((allocation) => allocation.type === type)?.upgrade_id
          : undefined
        return { type, count: form.rooms![type], ...(kept ? { upgrade_id: kept } : {}) }
      })
  }
  return journey
}

function useErrorMessage() {
  const tErr = useTranslations('ops.amend.errors')
  return (err: unknown): string => {
    const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
    if (code && tErr.has(code)) return tErr(code)
    if (code?.startsWith('SCHEDULE_')) return tErr('SCHEDULE')
    return tErr('generic')
  }
}

function Money({ value, signed }: { value: number | null | undefined; signed?: boolean }) {
  const locale = useLocale()
  const tCommon = useTranslations('ops.common')
  if (value == null) return <span>{tCommon('none')}</span>
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  return (
    <span dir="ltr" className="whitespace-nowrap tabular-nums">
      {sign}
      {formatAmount(Math.abs(value), locale)} {tCommon('egp')}
    </span>
  )
}

function Field({ label, htmlFor, className, children }: {
  label: string
  htmlFor?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Label htmlFor={htmlFor} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border bg-white p-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      <div className={cn('flex flex-col gap-3', !hint && 'mt-2')}>{children}</div>
    </section>
  )
}

function Stepper({ label, value, min, max, disableIncrease, onChange }: {
  label: string
  value: number
  min: number
  max: number
  disableIncrease?: boolean
  onChange: (next: number) => void
}) {
  const locale = useLocale()
  const t = useTranslations('ops.amend')
  return (
    <div role="group" aria-label={label} className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('decrease', { label })}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus />
      </Button>
      <span className="w-8 text-center font-medium tabular-nums" aria-live="polite">{formatCount(value, locale)}</span>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={t('increase', { label })}
        disabled={value >= max || disableIncrease}
        onClick={() => onChange(value + 1)}
      >
        <Plus />
      </Button>
    </div>
  )
}

/** Original vs revised totals, per-line comparison, payment split and the availability notice. */
function Comparison({ preview }: { preview: PreviewResult }) {
  const locale = useLocale()
  const t = useTranslations('ops.amend.compare')
  const ar = locale === 'ar'
  const { original, revised, difference } = preview

  const rows = useMemo(() => {
    const map = new Map<string, { key: string; label: string; original?: number; revised?: number }>()
    const labelOf = (line: QuoteLine) => (ar ? line.label_ar || line.label_en : line.label_en || line.label_ar)
    for (const line of original.lines) map.set(line.key, { key: line.key, label: labelOf(line), original: line.amount })
    for (const line of revised.lines) {
      const existing = map.get(line.key)
      map.set(line.key, { key: line.key, label: labelOf(line), original: existing?.original, revised: line.amount })
    }
    return [...map.values()]
  }, [original.lines, revised.lines, ar])

  const tone = difference > 0 ? 'text-red-700' : difference < 0 ? 'text-green-700' : 'text-gray-700'
  const direction = difference > 0 ? t('increase') : difference < 0 ? t('decrease') : t('noChange')
  const rooms = revised.rooms
  const payment = revised.payment

  return (
    <div className="flex flex-col gap-3 rounded-lg border-2 border-sea-900/20 bg-sea-50/40 p-3">
      <h3 className="text-sm font-semibold text-gray-900">{t('title')}</h3>

      <dl className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-white p-2">
          <dt className="text-xs text-muted-foreground">{t('original')}</dt>
          <dd className="text-sm font-semibold"><Money value={original.total} /></dd>
        </div>
        <div className="rounded-md bg-white p-2">
          <dt className="text-xs text-muted-foreground">{t('revised')}</dt>
          <dd className="text-sm font-semibold"><Money value={revised.total} /></dd>
        </div>
        <div className="rounded-md bg-white p-2">
          <dt className="text-xs text-muted-foreground">{t('difference')}</dt>
          <dd className={cn('text-sm font-semibold', tone)}><Money value={difference} signed /></dd>
          <dd className={cn('text-xs', tone)}>{direction}</dd>
        </div>
      </dl>

      {preview.availability_reset && (
        <p role="status" className={WARN_CLASS}>
          {t('availabilityReset')}
        </p>
      )}

      {revised.dates && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
          <span>
            {t('dates')}: {formatDate(revised.dates.arrivalDate, locale)}
            {' → '}
            {formatDate(revised.dates.departureDate, locale)}
          </span>
          <span>{t('nights', { n: formatCount(revised.dates.nights, locale) })}</span>
        </div>
      )}

      {rooms && (
        <div className="text-sm text-gray-700">
          <p>
            <span className="font-medium">{t('rooms')}: </span>
            <RoomsText allocations={rooms.allocations} />
            {' · '}
            <Badge variant="outline">{rooms.mode === 'recommended' ? t('roomsRecommended') : t('roomsCustom')}</Badge>
          </p>
          {rooms.mode === 'custom' && rooms.recommended && rooms.difference !== 0 && (
            <p className="text-xs text-muted-foreground">
              {t('roomsVsRecommended')} <Money value={rooms.difference} signed />
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{t('lines')}</span>
        <span className="text-end text-xs font-medium text-muted-foreground">{t('original')}</span>
        <span className="text-end text-xs font-medium text-muted-foreground">{t('revised')}</span>
        {rows.map((row) => (
          <div key={row.key} className="contents">
            <span className="min-w-0 break-words">{row.label}</span>
            <span className="text-end text-muted-foreground"><Money value={row.original} /></span>
            <span className="text-end"><Money value={row.revised} /></span>
          </div>
        ))}
        <span className="border-t pt-1 font-semibold">{t('total')}</span>
        <span className="border-t pt-1 text-end font-semibold"><Money value={original.total} /></span>
        <span className="border-t pt-1 text-end font-semibold"><Money value={revised.total} /></span>
      </div>

      {payment && (
        <div className="rounded-md bg-white p-2 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">{t('paymentPlan')}</p>
          <p className="flex justify-between gap-2">
            <span>{t('afterConfirmation')}</span>
            <Money value={payment.upfrontAmount} />
          </p>
          <p className="flex justify-between gap-2">
            <span>{payment.balanceDue === 'before_service' ? t('beforeService') : t('onArrival')}</span>
            <Money value={payment.balanceAmount} />
          </p>
        </div>
      )}
    </div>
  )
}

function RoomsText({ allocations }: { allocations: { type: RoomType; count: number }[] }) {
  const locale = useLocale()
  const tj = useTranslations('ops.journey')
  if (!allocations.length) return <>{'—'}</>
  return (
    <>
      {allocations
        .map((allocation) => tj('room', {
          type: tj(`roomTypes.${allocation.type}`),
          count: formatCount(allocation.count, locale),
        }))
        .join(' + ')}
    </>
  )
}

export function AmendJourneyDialog({ open, onOpenChange, data, updatedAt, onAmended, onStale }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  data: AmendData
  /** The item's current updated_at — sent back as the optimistic-concurrency token. */
  updatedAt: string
  onAmended: (result: AmendResult) => void
  onStale?: () => void
}) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const t = useTranslations('ops.amend')
  const tj = useTranslations('ops.journey')
  const tCommon = useTranslations('ops.common')
  const fetchJson = useOpsFetch()
  const errorMessage = useErrorMessage()

  const { request, catalog } = data
  const original = request.journey
  const base = `/api/admin/trip-requests/${request.id}/amend`

  const [form, setForm] = useState<Form>(() => initialForm(original))
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<{ key: string; data: PreviewResult } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [stale, setStale] = useState(false)
  const [extraPick, setExtraPick] = useState('')
  const sequence = useRef(0)
  const compareRef = useRef<HTMLDivElement>(null)

  const journey = useMemo(() => buildJourney(form, original), [form, original])
  const journeyKey = useMemo(() => JSON.stringify(journey), [journey])
  const previewFresh = preview?.key === journeyKey
  const previewData = preview?.data ?? null

  const name = (item: { name_ar: string; name_en: string }) => (
    ar ? item.name_ar || item.name_en : item.name_en || item.name_ar
  )
  const accommodation = catalog.accommodations.find((candidate) => candidate.id === form.accommodation) ?? null
  const patterns = patternsForMode(catalog.schedule, form.transport_mode)
  const governorates = catalog.governorates.filter((gov) => form.transport_mode === 'stay_only'
    || gov.transfer_types.includes(form.transport_mode as 'package_bus' | 'hiace'))
  const showDeparture = form.transport_mode === 'stay_only' || (form.transport_mode === 'hiace' && !form.pattern)
  const isAlternative = request.status === 'alternatives_required'

  const update = (patch: Partial<Form>) => setForm((current) => ({ ...current, ...patch }))

  const changeMode = (mode: TransportMode) => {
    const stayOnly = mode === 'stay_only'
    update({
      transport_mode: mode,
      origin: stayOnly ? '' : form.origin,
      pattern: '',
      departure: '',
      accommodation: stayOnly && !form.accommodation ? (catalog.accommodations[0]?.id ?? '') : form.accommodation,
    })
  }

  const changeAccommodation = (id: string) => {
    const next = catalog.accommodations.find((candidate) => candidate.id === id)
    const keepMeal = next?.meal_plans.some((plan) => plan.key === form.meal && plan.is_active)
    const keepUpgrade = next?.room_upgrades.some((upgrade) => upgrade.id === form.upgrade)
    update({
      accommodation: id,
      meal: keepMeal ? form.meal : '',
      upgrade: keepUpgrade ? form.upgrade : '',
    })
  }

  // Counts shown by the room steppers: staff's custom plan, else the last server recommendation.
  const previewedRooms = previewData?.revised.rooms
  const shownRooms: RoomCounts = form.rooms
    ?? (previewedRooms ? countsOf(previewedRooms.allocations) : countsOf(original.room_allocations))
  const roomTypeInfo = (type: RoomType) => previewedRooms?.room_types.find((info) => info.type === type)
  const originalRooms = countsOf(original.room_allocations)
  const originalRoomList = ROOM_TYPES
    .map((type) => ({ type, count: originalRooms[type] }))
    .filter((allocation) => allocation.count > 0)
  const hasOriginalRooms = originalRoomList.length > 0
  const guests = form.adults + form.children

  const setRoomCount = (type: RoomType, count: number) => {
    update({ rooms: { ...shownRooms, [type]: Math.max(0, count) } })
  }

  const addExperience = (value: string) => {
    const [kind, id] = value.split(':')
    if (!id || form.experiences.length >= MAX_EXPERIENCES) return
    update({ experiences: [...form.experiences, { kind: kind as AmendExperience['kind'], id }] })
    setExtraPick('')
  }

  const experienceName = (experience: AmendExperience) => {
    const found = experience.kind === 'trip'
      ? catalog.trips.find((trip) => trip.id === experience.id)
      : catalog.packages.find((pkg) => pkg.id === experience.id)
    return found ? name(found) : experience.id.slice(0, 8)
  }

  const runPreview = async () => {
    const seq = ++sequence.current
    setPreviewing(true)
    setPreviewError('')
    setSubmitError('')
    setStale(false)
    try {
      const res: PreviewResult = await fetchJson(`${base}/preview`, {
        method: 'POST',
        body: JSON.stringify({ journey }),
      })
      if (seq !== sequence.current) return
      setPreview({ key: JSON.stringify(journey), data: res })
      requestAnimationFrame(() => compareRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
    } catch (err) {
      if (seq !== sequence.current) return
      setPreview(null)
      setPreviewError(errorMessage(err))
    } finally {
      if (seq === sequence.current) setPreviewing(false)
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setSubmitError('')
    setStale(false)
    try {
      const res: AmendResult = await fetchJson(base, {
        method: 'POST',
        body: JSON.stringify({ journey, expected_updated_at: updatedAt, reason: reason.trim() }),
      })
      onAmended(res)
      onOpenChange(false)
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      setStale(code === 'stale_request')
      setSubmitError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const blocker = previewData?.blocker ?? null
  const canPreview = !previewing && !submitting && Boolean(form.arrival) && form.adults >= 1
  const canConfirm = previewFresh && !blocker && reason.trim().length > 0 && !submitting && !previewing

  const experienceLimit = form.experiences.length >= MAX_EXPERIENCES
  const selectedKeys = new Set(form.experiences.map((experience) => `${experience.kind}:${experience.id}`))
  const availableTrips = catalog.trips.filter((trip) => !selectedKeys.has(`trip:${trip.id}`))
  const availablePackages = catalog.packages.filter((pkg) => !selectedKeys.has(`trip_package:${pkg.id}`))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b p-4 pe-12">
          <DialogTitle className="text-base">{isAlternative ? t('proposeAlternative') : t('editBooking')}</DialogTitle>
          <DialogDescription>
            {t('dialogIntro', { reference: request.reference, customer: request.customer_name })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <Section title={t('sections.dates')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('fields.transportMode')} htmlFor="amend-mode">
                <select
                  id="amend-mode"
                  className={SELECT_CLASS}
                  value={form.transport_mode}
                  onChange={(e) => changeMode(e.target.value as TransportMode)}
                >
                  {TRANSPORT_MODES.map((mode) => <option key={mode} value={mode}>{tj(`transport.${mode}`)}</option>)}
                </select>
              </Field>
              {form.transport_mode !== 'stay_only' && (
                <Field label={t('fields.origin')} htmlFor="amend-origin">
                  <select
                    id="amend-origin"
                    className={SELECT_CLASS}
                    value={form.origin}
                    onChange={(e) => update({ origin: e.target.value })}
                  >
                    <option value="">{t('fields.notSet')}</option>
                    {governorates.map((gov) => <option key={gov.code} value={gov.code}>{name(gov)}</option>)}
                  </select>
                </Field>
              )}
              {form.transport_mode !== 'stay_only' && (
                <Field label={t('fields.stayPattern')} htmlFor="amend-pattern">
                  <select
                    id="amend-pattern"
                    className={SELECT_CLASS}
                    value={form.pattern}
                    onChange={(e) => update({ pattern: e.target.value, departure: '' })}
                  >
                    {form.transport_mode === 'hiace'
                      ? <option value="">{t('fields.customDates')}</option>
                      : <option value="">{t('fields.notSet')}</option>}
                    {patterns.map((pattern) => (
                      <option key={pattern.code} value={pattern.code}>{ar ? pattern.nameAr : pattern.nameEn}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label={t('fields.arrival')} htmlFor="amend-arrival">
                <Input
                  id="amend-arrival"
                  type="date"
                  dir="ltr"
                  value={form.arrival}
                  onChange={(e) => update({ arrival: e.target.value })}
                />
              </Field>
              {showDeparture && (
                <Field label={t('fields.departure')} htmlFor="amend-departure">
                  <Input
                    id="amend-departure"
                    type="date"
                    dir="ltr"
                    min={form.arrival || undefined}
                    value={form.departure}
                    onChange={(e) => update({ departure: e.target.value })}
                  />
                </Field>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {t('fields.currentDates', {
                arrival: formatDate(original.arrival_date, locale),
                departure: original.departure_date ? formatDate(original.departure_date, locale) : '—',
              })}
            </p>
          </Section>

          <Section title={t('sections.travellers')}>
            <div className="flex flex-wrap gap-x-8 gap-y-3">
              <Field label={t('fields.adults')}>
                <Stepper
                  label={t('fields.adults')}
                  value={form.adults}
                  min={1}
                  max={50}
                  onChange={(adults) => update({ adults })}
                />
              </Field>
              <Field label={t('fields.children')}>
                <Stepper
                  label={t('fields.children')}
                  value={form.children}
                  min={0}
                  max={50}
                  onChange={(children) => update({ children })}
                />
              </Field>
            </div>
          </Section>

          <Section title={t('sections.stay')}>
            <Field label={t('fields.accommodation')} htmlFor="amend-stay">
              <select
                id="amend-stay"
                className={SELECT_CLASS}
                value={form.accommodation}
                onChange={(e) => changeAccommodation(e.target.value)}
              >
                {form.transport_mode !== 'stay_only' && <option value="">{t('fields.noStay')}</option>}
                {catalog.accommodations.map((stay) => (
                  <option key={stay.id} value={stay.id}>
                    {name(stay)}{stay.id === original.accommodation_id ? ` (${t('fields.currentStay')})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </Section>

          {accommodation && (
            <Section title={t('sections.rooms')} hint={form.rooms ? t('rooms.customNote') : t('rooms.recommendedNote')}>
              <div className="flex flex-col gap-2">
                {ROOM_TYPES.map((type) => {
                  const info = roomTypeInfo(type)
                  const unavailable = info ? !info.available : false
                  const label = tj(`roomTypes.${type}`)
                  return (
                    <div key={type} className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {info ? t('rooms.capacity', { n: formatCount(info.capacity, locale) }) : ''}
                          {info?.stay_total_per_room != null && (
                            <>
                              {' · '}
                              <Money value={info.stay_total_per_room} />
                            </>
                          )}
                          {unavailable && ` · ${t('rooms.unavailable')}`}
                        </p>
                      </div>
                      <Stepper
                        label={label}
                        value={shownRooms[type]}
                        min={0}
                        max={20}
                        disableIncrease={unavailable}
                        onChange={(count) => setRoomCount(type, count)}
                      />
                    </div>
                  )
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {form.rooms && (
                  <Button type="button" variant="outline" size="sm" onClick={() => update({ rooms: null })}>
                    <RotateCcw className="me-1" />
                    {t('rooms.useRecommended')}
                  </Button>
                )}
                {hasOriginalRooms && (
                  <Button type="button" variant="outline" size="sm" onClick={() => update({ rooms: originalRooms })}>
                    {t('rooms.keepCurrent')}
                  </Button>
                )}
                {hasOriginalRooms && (
                  <span className="text-xs text-muted-foreground">
                    {t('rooms.current')}: <RoomsText allocations={originalRoomList} />
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('rooms.guests', { n: formatCount(guests, locale) })}
              </p>
            </Section>
          )}

          {accommodation && (
            <Section title={t('sections.mealUpgrade')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('fields.mealPlan')} htmlFor="amend-meal">
                  <select
                    id="amend-meal"
                    className={SELECT_CLASS}
                    value={form.meal}
                    onChange={(e) => update({ meal: e.target.value })}
                  >
                    <option value="">{t('fields.defaultMeal')}</option>
                    {accommodation.meal_plans.filter((plan) => plan.is_active).map((plan) => (
                      <option key={plan.key} value={plan.key}>{ar ? plan.label_ar : plan.label_en}</option>
                    ))}
                  </select>
                </Field>
                <Field label={t('fields.upgrade')} htmlFor="amend-upgrade">
                  <select
                    id="amend-upgrade"
                    className={SELECT_CLASS}
                    value={form.upgrade}
                    onChange={(e) => update({ upgrade: e.target.value })}
                  >
                    <option value="">{t('fields.noUpgrade')}</option>
                    {accommodation.room_upgrades.map((upgrade) => (
                      <option key={upgrade.id} value={upgrade.id}>{name(upgrade)}</option>
                    ))}
                  </select>
                </Field>
              </div>
            </Section>
          )}

          <Section
            title={t('sections.experiences')}
            hint={t('experiences.max', { n: formatCount(MAX_EXPERIENCES, locale) })}
          >
            {form.experiences.length === 0 && (
              <p className="text-sm text-muted-foreground">{t('experiences.none')}</p>
            )}
            {form.experiences.map((experience, index) => (
              <div key={`${experience.kind}:${experience.id}`} className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{tj(`kind.${experience.kind}`)}</Badge>
                <span className="min-w-0 flex-1 text-sm font-medium">{experienceName(experience)}</span>
                <Input
                  type="date"
                  dir="ltr"
                  className="h-9 w-40"
                  aria-label={t('experiences.preferredDate')}
                  value={experience.preferred_date ?? ''}
                  onChange={(e) => update({
                    experiences: form.experiences.map((item, i) => i === index
                      ? { ...item, preferred_date: e.target.value || undefined }
                      : item),
                  })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t('experiences.remove', { name: experienceName(experience) })}
                  onClick={() => update({ experiences: form.experiences.filter((_, i) => i !== index) })}
                >
                  <X />
                </Button>
              </div>
            ))}
            <Field label={t('experiences.add')} htmlFor="amend-add-experience">
              <select
                id="amend-add-experience"
                className={SELECT_CLASS}
                value={extraPick}
                disabled={experienceLimit}
                onChange={(e) => addExperience(e.target.value)}
              >
                <option value="">{experienceLimit ? t('experiences.limit') : t('experiences.choose')}</option>
                {availableTrips.length > 0 && (
                  <optgroup label={tj('kind.trip')}>
                    {availableTrips.map((trip) => (
                      <option key={trip.id} value={`trip:${trip.id}`}>{name(trip)}</option>
                    ))}
                  </optgroup>
                )}
                {availablePackages.length > 0 && (
                  <optgroup label={tj('kind.trip_package')}>
                    {availablePackages.map((pkg) => (
                      <option key={pkg.id} value={`trip_package:${pkg.id}`}>{name(pkg)}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </Field>
          </Section>

          <div ref={compareRef} className="flex flex-col gap-3">
            {previewing && (
              <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('previewing')}
              </p>
            )}
            {previewError && <p role="alert" className={ERROR_CLASS}>{previewError}</p>}
            {previewData && !previewing && (
              <>
                {!previewFresh && (
                  <p role="status" className={WARN_CLASS}>
                    {t('compare.stale')}
                  </p>
                )}
                <div className={cn(!previewFresh && 'opacity-60')}>
                  <Comparison preview={previewData} />
                </div>
                {blocker && <p role="alert" className={ERROR_CLASS}>{t(`blocked.${blocker}`)}</p>}
              </>
            )}
            {!previewData && !previewing && !previewError && (
              <p className="text-sm text-muted-foreground">{t('compare.needPreview')}</p>
            )}
          </div>

          <Section title={t('sections.reason')}>
            <Field label={t('reason.label')} htmlFor="amend-reason">
              <Textarea
                id="amend-reason"
                rows={3}
                maxLength={MAX_REASON}
                value={reason}
                placeholder={t('reason.placeholder')}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <p className="text-xs text-muted-foreground">
              {t('reason.counter', { n: formatCount(reason.length, locale), max: formatCount(MAX_REASON, locale) })}
            </p>
          </Section>
        </div>

        {submitError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-2 border-t bg-red-50 p-3 text-sm text-red-700"
          >
            <span>{submitError}</span>
            {stale && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { onOpenChange(false); onStale?.() }}
              >
                <RotateCcw className="me-1" />
                {t('reloadLatest')}
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="m-0 flex-wrap">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </Button>
          <Button variant="outline" onClick={runPreview} disabled={!canPreview}>
            {previewing && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {previewing ? t('previewing') : t('previewButton')}
          </Button>
          <Button onClick={submit} disabled={!canConfirm}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {submitting ? t('confirming') : t('confirmButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The staff-facing entry point for ItemDetail: loads the amend context (journey + catalog + blocker),
 * renders the button with a visible reason when amending is blocked, and owns the dialog.
 */
export function AmendJourneyAction({ requestId, status, updatedAt, onAmended, onStale }: {
  requestId: string
  status: string
  updatedAt: string
  onAmended: (result: AmendResult) => void
  onStale?: () => void
}) {
  const t = useTranslations('ops.amend')
  const fetchJson = useOpsFetch()
  const [data, setData] = useState<AmendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res: AmendData = await fetchJson(`/api/admin/trip-requests/${requestId}/amend`)
      setData(res)
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(true)
    } finally {
      setLoading(false)
    }
  }, [requestId, fetchJson])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load, updatedAt, status])

  const blocker = data?.blocker ?? null
  const alternative = status === 'alternatives_required'
  const label = alternative ? t('proposeAlternative') : t('editBooking')

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={alternative ? 'default' : 'outline'}
          disabled={loading || error || !data || blocker !== null}
          onClick={() => setOpen(true)}
        >
          {loading ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : <Pencil className="me-2 h-4 w-4" />}
          {label}
        </Button>
        {error && (
          <Button size="sm" variant="ghost" onClick={load}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t('retryLoad')}
          </Button>
        )}
      </div>
      {alternative && !blocker && <p className="text-xs text-muted-foreground">{t('alternativesHint')}</p>}
      {blocker && <p className="text-sm text-amber-900">{t(`blocked.${blocker}`)}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{t('loadFailed')}</p>}
      {open && data && !blocker && (
        <AmendJourneyDialog
          key={data.request.updated_at}
          open={open}
          onOpenChange={setOpen}
          data={data}
          updatedAt={updatedAt || data.request.updated_at}
          onAmended={onAmended}
          onStale={onStale}
        />
      )}
    </div>
  )
}
