'use client'

import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { BedDouble, CalendarDays, Home, MapPinned, MessageCircle, Route, Send, Sparkles, Users } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Section, StickyActionBar } from '@/components/brand'
import { formatAmount } from '@/lib/format'
import { trackConversion, trackRequestFailure } from '@/lib/conversion'
import { contactSchema } from '@/lib/trip-requests/schema'
import { builderReducer, initialBuilderState } from '@/lib/trip-builder/state'
import { sectionStatus, toSubmitPayload, type SectionState } from '@/lib/trip-builder/sections'
import {
  datesSummary,
  experiencesSummary,
  roomsSummary,
  staySummary,
  transportSummary,
  travelersSummary,
} from '@/lib/trip-builder/summaries'
import { buildHandoffMessage, whatsappLink } from '@/lib/trip-builder/whatsapp'
import type { BuilderCatalog } from '@/lib/trip-builder/types'
import { ContactStep } from './ContactStep'
import { DatesStep } from './DatesStep'
import { ExperiencesStep } from './ExperiencesStep'
import { JourneySection, StaticSection } from './JourneySection'
import { MobileSummarySheet } from './MobileSummarySheet'
import { OverviewTimeline } from './OverviewTimeline'
import { PriceSummary } from './PriceSummary'
import { RoomsMealStep } from './RoomsMealStep'
import { StayStep } from './StayStep'
import { TransportStep } from './TransportStep'
import { TravellersStep } from './TravellersStep'
import { SuccessState, type SubmitSuccess } from './SuccessState'
import { useDraftPersistence } from './useDraftPersistence'
import { useQuote } from './useQuote'

type Props = { catalog: BuilderCatalog; locale: 'ar' | 'en'; prefill: Record<string, string | string[] | undefined> }

const STEP_ORDER = ['transport', 'dates', 'travelers', 'stay', 'rooms', 'experiences'] as const
type StepId = (typeof STEP_ORDER)[number]

const STEP_ICON: Record<StepId, ReactNode> = {
  transport: <Route className="h-5 w-5" aria-hidden />,
  dates: <CalendarDays className="h-5 w-5" aria-hidden />,
  travelers: <Users className="h-5 w-5" aria-hidden />,
  stay: <Home className="h-5 w-5" aria-hidden />,
  rooms: <BedDouble className="h-5 w-5" aria-hidden />,
  experiences: <Sparkles className="h-5 w-5" aria-hidden />,
}

/**
 * Literal-key switch, not a `Record` looked up by a runtime `id` — see the
 * note in `JourneySection.tsx`. `t` is passed in rather than calling
 * `useTranslations` here so this stays a plain function (used inside a
 * `.map`, not its own component).
 */
function stepTitle(t: ReturnType<typeof useTranslations>, id: StepId): { title: string; subtitle: string } {
  switch (id) {
    case 'transport': return { title: t('stepTransportTitle'), subtitle: t('stepTransportSubtitle') }
    case 'dates': return { title: t('stepDatesTitle'), subtitle: t('stepDatesSubtitle') }
    case 'travelers': return { title: t('stepTravellersTitle'), subtitle: t('stepTravellersSubtitle') }
    case 'stay': return { title: t('stepStayTitle'), subtitle: t('stepStaySubtitle') }
    case 'rooms': return { title: t('stepRoomsTitle'), subtitle: t('stepRoomsSubtitle') }
    case 'experiences': return { title: t('stepExperiencesTitle'), subtitle: t('stepExperiencesSubtitle') }
  }
}

/**
 * Trip Builder orchestrator — owns the reducer, the draft/quote hooks, and
 * which journey section is open. Every step's own rendering, validation
 * copy and layout lives in its dedicated component; this file wires state
 * to them and never renders form controls itself.
 */
export function TripBuilder({ catalog, locale, prefill }: Props) {
  const t = useTranslations('builder')
  const [state, dispatch] = useReducer(builderReducer, undefined, initialBuilderState)
  const [success, setSuccess] = useState<SubmitSuccess | null>(null)
  const [pinnedStep, setPinnedStep] = useState<StepId | 'contact' | null>(null)
  const [summarySheetOpen, setSummarySheetOpen] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [contactTouched, setContactTouched] = useState(false)

  const persistence = useDraftPersistence({ state, dispatch, catalog, prefill, paused: Boolean(success) })
  const quoteState = useQuote(state, locale)

  const statuses = sectionStatus(state, catalog)
  const stepStatus = (id: StepId): SectionState['status'] => {
    if (id === 'transport') {
      if (statuses.transport.status !== 'complete') return statuses.transport.status
      return state.transport_mode === 'stay_only' || statuses.origin.status === 'complete' ? 'complete' : 'needs_input'
    }
    return statuses[id].status
  }
  const visibleSteps = STEP_ORDER.filter((id) => stepStatus(id) !== 'not_applicable')
  const firstIncomplete = visibleSteps.find((id) => stepStatus(id) === 'needs_input') ?? null
  const activeStep = pinnedStep ?? firstIncomplete

  // Once the pinned step resolves, hand control back to the automatic flow
  // so it advances to the next incomplete section on its own.
  const wasPinnedIncomplete = useRef(false)
  useEffect(() => {
    if (pinnedStep && pinnedStep !== 'contact') {
      const complete = stepStatus(pinnedStep) === 'complete'
      if (wasPinnedIncomplete.current && complete) setPinnedStep(null)
      wasPinnedIncomplete.current = !complete
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pinnedStep, state])

  const sectionRefs = useRef<Partial<Record<StepId | 'contact', HTMLDivElement | null>>>({})
  const activate = (id: StepId | 'contact') => {
    setPinnedStep(id)
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const contactValid = contactSchema.safeParse(state.contact).success

  const summaryFor = (id: StepId) => {
    switch (id) {
      case 'transport': return transportSummary(state, catalog, locale)
      case 'dates': return datesSummary(state, catalog, locale)
      case 'travelers': return travelersSummary(state)
      case 'stay': return staySummary(state, catalog, locale)
      case 'rooms': return roomsSummary(state, catalog, locale)
      case 'experiences': return experiencesSummary(state)
    }
  }

  const prefillStayId = typeof prefill.stay === 'string' ? prefill.stay : undefined
  const whatsappHint = catalog.whatsappNumber
    ? whatsappLink(catalog.whatsappNumber, buildHandoffMessage({ state, catalog, locale, total: quoteState.quote?.total }))
    : undefined

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setContactTouched(true)
    setSubmitError('')
    const parsed = contactSchema.safeParse(state.contact)
    if (!quoteState.ready || !parsed.success) {
      setSubmitError(t('completeRequired'))
      activate('contact')
      return
    }
    setSubmitting(true)
    try {
      const response = await fetch('/api/trip-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSubmitPayload(state, parsed.data, locale, { notes: state.notes, website: honeypot, turnstile_token: turnstileToken ?? undefined })),
      })
      const body = (await response.json()) as { reference?: string; quoted_total?: number; code?: string }
      if (!response.ok) throw new Error(body.code ?? 'server')
      setSuccess({ reference: body.reference, total: body.quoted_total })
      persistence.clear()
      trackConversion('trip_request_submitted', { content_type: 'trip', source: 'trip_builder', value: body.quoted_total, currency: 'EGP', reference: body.reference })
    } catch (error) {
      setSubmitError(t('submitError'))
      trackRequestFailure('trip', (error as Error).message === 'server' ? 'server' : 'network')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    dispatch({ type: 'reset' })
    setSuccess(null)
    setPinnedStep(null)
    setContactTouched(false)
  }

  if (!catalog.transferServices.length && !catalog.accommodations.length) {
    return (
      <Section>
        <EmptyState variant="curating" title={t('curatingTitle')} hint={t('curatingHint')} />
      </Section>
    )
  }

  if (success) {
    return <SuccessState catalog={catalog} state={state} locale={locale} success={success} onReset={reset} />
  }

  const dominantAction = firstIncomplete
    ? { label: t('continue'), onClick: () => activate(firstIncomplete) }
    : !contactValid
      ? { label: t('reviewRequest'), onClick: () => activate('contact') }
      : { label: submitting ? t('sending') : t('sendRequest'), onClick: () => sectionRefs.current.contact?.querySelector('form')?.requestSubmit() }

  return (
    <main className="overflow-x-clip bg-sand-50 pb-4">
      <Section tone="night" size="md">
        <div className="container-main">
          <p className="text-sm font-semibold text-sun-300">{t('heroKicker')}</p>
          <h1 className="mt-3 max-w-3xl font-display text-4xl font-bold leading-tight text-sand-50 sm:text-5xl">{t('title')}</h1>
          <p className="mt-3 max-w-2xl text-sand-100/80">{t('intro')}</p>
        </div>
      </Section>

      <Section size="md">
        <div className="container-main grid gap-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            {visibleSteps.map((id, index) => (
              <div key={id} ref={(el) => { sectionRefs.current[id] = el }}>
                <JourneySection
                  index={index + 1}
                  icon={STEP_ICON[id]}
                  title={stepTitle(t, id).title}
                  subtitle={stepTitle(t, id).subtitle}
                  active={activeStep === id}
                  complete={stepStatus(id) === 'complete'}
                  optional={stepStatus(id) === 'optional'}
                  summary={summaryFor(id)}
                  locale={locale}
                  onActivate={() => setPinnedStep(id)}
                >
                  {id === 'transport' && <TransportStep state={state} catalog={catalog} locale={locale} dispatch={dispatch} />}
                  {id === 'dates' && <DatesStep state={state} catalog={catalog} locale={locale} dispatch={dispatch} />}
                  {id === 'travelers' && <TravellersStep state={state} locale={locale} dispatch={dispatch} />}
                  {id === 'stay' && <StayStep state={state} catalog={catalog} locale={locale} prefillStayId={prefillStayId} dispatch={dispatch} />}
                  {id === 'rooms' && <RoomsMealStep state={state} catalog={catalog} locale={locale} dispatch={dispatch} />}
                  {id === 'experiences' && <ExperiencesStep state={state} catalog={catalog} locale={locale} dispatch={dispatch} />}
                </JourneySection>
              </div>
            ))}

            <StaticSection index={visibleSteps.length + 1} icon={<MapPinned className="h-5 w-5" aria-hidden />} title={t('stepOverviewTitle')} locale={locale}>
              <OverviewTimeline state={state} catalog={catalog} locale={locale} />
            </StaticSection>

            <div ref={(el) => { sectionRefs.current.contact = el }}>
              <StaticSection index={visibleSteps.length + 2} icon={<Send className="h-5 w-5" aria-hidden />} title={t('stepContactTitle')} locale={locale}>
                <form onSubmit={submit} noValidate>
                  <ContactStep
                    state={state}
                    honeypot={honeypot}
                    submitError={submitError}
                    submitting={submitting}
                    touched={contactTouched}
                    onChange={(contact) => dispatch({ type: 'setContact', contact })}
                    onNotes={(notes) => dispatch({ type: 'setNotes', notes })}
                    onHoneypot={setHoneypot}
                    onTurnstile={setTurnstileToken}
                  />
                </form>
              </StaticSection>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="rounded-3xl border-[1.5px] border-sand-300 bg-white p-5 shadow-sm">
                <p className="mb-3.5 font-display text-lg font-bold text-sea-900">{t('yourTrip')}</p>
                <PriceSummary quote={quoteState.quote} refreshing={quoteState.refreshing} errorKey={quoteState.errorKey} policies={catalog.paymentPolicies} locale={locale} />
              </div>
              {whatsappHint && (
                <a
                  href={whatsappHint}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-full border-[1.5px] border-[#128c4a] text-sm font-semibold text-[#128c4a] transition-colors hover:bg-[#128c4a]/5"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {t('whatsapp')}
                </a>
              )}
            </div>
          </aside>
        </div>
      </Section>

      <StickyActionBar
        summary={
          <button type="button" onClick={() => setSummarySheetOpen(true)} className="min-h-11 text-start">
            <span className="block text-xs font-medium text-ink-subtle">{t('yourTrip')}</span>
            <span className="block text-sm font-bold text-sea-900">{quoteState.quote ? `${formatAmount(quoteState.quote.total, locale)} EGP` : t('addDates')}</span>
          </button>
        }
        action={
          <button type="button" onClick={dominantAction.onClick} disabled={submitting} className="min-h-11 rounded-full bg-sun-500 px-5 text-sm font-bold text-on-accent transition-colors hover:bg-sun-600 disabled:opacity-60">
            {dominantAction.label}
          </button>
        }
      />

      <MobileSummarySheet
        open={summarySheetOpen}
        onOpenChange={setSummarySheetOpen}
        state={state}
        catalog={catalog}
        locale={locale}
        quote={quoteState.quote}
        refreshing={quoteState.refreshing}
        errorKey={quoteState.errorKey}
        policies={catalog.paymentPolicies}
      />
    </main>
  )
}
