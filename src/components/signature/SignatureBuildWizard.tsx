'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, MessageCircle, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { Chip, ChipRail } from '@/components/brand/Chip'
import { ArrowBack, ArrowForward } from '@/components/brand/DirectionalIcon'
import { StickyActionBar } from '@/components/brand/StickyActionBar'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { formatCount, formatDate } from '@/lib/format'
import { trackConversion, trackRequestFailure } from '@/lib/conversion'
import { cn } from '@/lib/utils'
import {
  EMPTY_SIGNATURE_BUILD_DRAFT,
  SIGNATURE_BUILD_STEPS,
  buildSignatureRequestPayload,
  furthestReachableStep,
  isStepValid,
  type SignatureBuildDraft,
  type SignatureBuildStep,
  type SignatureBudgetComfort,
  type SignaturePace,
} from '@/lib/signature-build'

const VIBE_IDS = [
  'diving',
  'freediving',
  'desert',
  'hiking',
  'foodAndCulture',
  'celebration',
  'slowTravel',
  'adventure',
] as const

const VIBE_KEY: Record<(typeof VIBE_IDS)[number], string> = {
  diving: 'vibeDiving',
  freediving: 'vibeFreediving',
  desert: 'vibeDesert',
  hiking: 'vibeHiking',
  foodAndCulture: 'vibeFoodAndCulture',
  celebration: 'vibeCelebration',
  slowTravel: 'vibeSlowTravel',
  adventure: 'vibeAdventure',
}

const PACE_OPTIONS: readonly SignaturePace[] = ['relaxed', 'balanced', 'packed']
const PACE_KEY: Record<SignaturePace, string> = {
  relaxed: 'paceRelaxed',
  balanced: 'paceBalanced',
  packed: 'pacePacked',
}

const BUDGET_OPTIONS: readonly SignatureBudgetComfort[] = ['simple', 'mid', 'no_limit']
const BUDGET_KEY: Record<SignatureBudgetComfort, string> = {
  simple: 'budgetSimple',
  mid: 'budgetMid',
  no_limit: 'budgetNoLimit',
}

/** Preselected-experience entry point (e.g. later linked from an experience detail page). Optional — the wizard is equally the /signature/build custom brief. */
export function SignatureBuildWizard({ experienceId }: { experienceId?: string }) {
  const t = useTranslations('signatureV2')
  const locale = useLocale()

  const [draft, setDraft] = useState<SignatureBuildDraft>(EMPTY_SIGNATURE_BUILD_DRAFT)
  const [step, setStep] = useState<SignatureBuildStep>('experience')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const stepIndex = SIGNATURE_BUILD_STEPS.indexOf(step)
  const maxReachable = useMemo(() => furthestReachableStep(draft), [draft])
  const maxReachableIndex = SIGNATURE_BUILD_STEPS.indexOf(maxReachable)
  const isLastStep = stepIndex === SIGNATURE_BUILD_STEPS.length - 1
  const canAdvance = isStepValid(step, draft)

  function update<K extends keyof SignatureBuildDraft>(key: K, value: SignatureBuildDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  function toggleVibe(id: string) {
    setDraft((prev) => ({
      ...prev,
      vibes: prev.vibes.includes(id) ? prev.vibes.filter((v) => v !== id) : [...prev.vibes, id],
    }))
  }

  function goNext() {
    if (!canAdvance || isLastStep) return
    setStep(SIGNATURE_BUILD_STEPS[stepIndex + 1])
  }
  function goBack() {
    if (stepIndex === 0) return
    setStep(SIGNATURE_BUILD_STEPS[stepIndex - 1])
  }

  async function submit() {
    if (honeypot) return // silently drop — bot filled the hidden field
    setSubmitting(true)
    setError('')
    const payload = { ...buildSignatureRequestPayload(draft), experience_id: experienceId, website: honeypot, turnstile_token: turnstileToken || undefined }
    try {
      const res = await fetch('/api/experience-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      trackConversion('build_signature_request_submitted', { content_type: 'signature', item_id: experienceId || 'custom', source: 'signature_build' })
      setSubmitted(true)
    } catch {
      trackRequestFailure('signature', 'network')
      setError(t('requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  function startOver() {
    setDraft(EMPTY_SIGNATURE_BUILD_DRAFT)
    setStep('experience')
    setSubmitted(false)
    setError('')
  }

  if (submitted) {
    const waMessage = t('waMessagePrefill', { idea: draft.experienceIdea })
    return (
      <div className="rounded-3xl border-[1.5px] border-sand-300 bg-card p-6 text-center md:p-10">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="mt-5 font-display text-xl font-bold text-sea-900">{t('requestSent')}</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-muted">{t('requestSentBody')}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            {t('whatsappCta')}
          </a>
          <button
            type="button"
            onClick={startOver}
            className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-sand-300 px-5 text-sm font-semibold text-ink-muted transition-colors hover:bg-sand-100"
          >
            {t('startOver')}
          </button>
        </div>
      </div>
    )
  }

  const summaryFacts = [
    draft.experienceIdea.trim() && draft.experienceIdea.trim(),
    draft.vibes.length > 0 && draft.vibes.join(' · '),
    maxReachableIndex >= 1 && `${formatCount(draft.travelers, locale)} · ${t('travelersLabel')}`,
    maxReachableIndex >= 2 &&
      (draft.dateMode === 'flexible' ? t('dateModeFlexible') : formatDate(draft.preferredDate, locale)),
    draft.pace && t(PACE_KEY[draft.pace]),
    draft.budgetComfort && t(BUDGET_KEY[draft.budgetComfort]),
  ].filter(Boolean) as string[]

  return (
    <div>
      {/* Progress */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 gap-1.5">
          {SIGNATURE_BUILD_STEPS.map((s, i) => (
            <span
              key={s}
              aria-hidden
              className={cn('h-1.5 flex-1 rounded-full transition-colors', i <= stepIndex ? 'bg-sun-500' : 'bg-sand-300')}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs font-semibold text-ink-subtle">
          {t('buildStepOf', {
            current: formatCount(stepIndex + 1, locale),
            total: formatCount(SIGNATURE_BUILD_STEPS.length, locale),
          })}
        </span>
      </div>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="min-w-0 rounded-3xl border-[1.5px] border-sand-300 bg-card p-6 md:p-8">
          {step === 'experience' && (
            <fieldset className="min-w-0">
              <legend className="font-display text-xl font-bold text-sea-900">{t('stepExperienceTitle')}</legend>
              <p className="mt-1.5 text-sm text-ink-muted">{t('stepExperienceHint')}</p>
              <Textarea
                autoFocus
                value={draft.experienceIdea}
                onChange={(e) => update('experienceIdea', e.target.value)}
                placeholder={t('stepExperiencePlaceholder')}
                rows={4}
                maxLength={500}
                className="mt-5"
              />
              <p className="mt-5 text-xs font-semibold text-ink-subtle">{t('stepVibesLabel')}</p>
              <ChipRail className="mt-2.5">
                {VIBE_IDS.map((id) => {
                  const label = t(VIBE_KEY[id])
                  return (
                    <Chip key={id} selected={draft.vibes.includes(label)} onClick={() => toggleVibe(label)}>
                      {label}
                    </Chip>
                  )
                })}
              </ChipRail>
            </fieldset>
          )}

          {step === 'travelers' && (
            <fieldset className="min-w-0">
              <legend className="font-display text-xl font-bold text-sea-900">{t('stepTravelersTitle')}</legend>
              <p className="mt-1.5 text-sm text-ink-muted">{t('stepTravelersHint')}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="travelers">{t('travelersLabel')}</Label>
                  <Input
                    id="travelers"
                    type="number"
                    min={1}
                    max={50}
                    value={draft.travelers}
                    onChange={(e) => update('travelers', Number(e.target.value) || 1)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="occasion">{t('occasionLabel')}</Label>
                  <Input
                    id="occasion"
                    value={draft.occasion}
                    onChange={(e) => update('occasion', e.target.value)}
                    placeholder={t('occasionPlaceholder')}
                    maxLength={120}
                    className="mt-1"
                  />
                </div>
              </div>
            </fieldset>
          )}

          {step === 'when' && (
            <fieldset className="min-w-0">
              <legend className="font-display text-xl font-bold text-sea-900">{t('stepWhenTitle')}</legend>
              <p className="mt-1.5 text-sm text-ink-muted">{t('stepWhenHint')}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Chip selected={draft.dateMode === 'flexible'} onClick={() => update('dateMode', 'flexible')}>
                  {t('dateModeFlexible')}
                </Chip>
                <Chip selected={draft.dateMode === 'fixed'} onClick={() => update('dateMode', 'fixed')}>
                  {t('dateModeFixed')}
                </Chip>
              </div>
              {draft.dateMode === 'fixed' && (
                <div className="mt-4 max-w-xs">
                  <Label htmlFor="preferred_date">{t('preferredDateLabel')}</Label>
                  <Input
                    id="preferred_date"
                    type="date"
                    value={draft.preferredDate}
                    onChange={(e) => update('preferredDate', e.target.value)}
                    className="mt-1"
                  />
                </div>
              )}
            </fieldset>
          )}

          {step === 'vibe' && (
            <fieldset className="min-w-0">
              <legend className="font-display text-xl font-bold text-sea-900">{t('stepVibeTitle')}</legend>
              <p className="mt-1.5 text-sm text-ink-muted">{t('stepVibeHint')}</p>
              <p className="mt-5 text-xs font-semibold text-ink-subtle">{t('paceLabel')}</p>
              <ChipRail className="mt-2.5">
                {PACE_OPTIONS.map((pace) => (
                  <Chip key={pace} selected={draft.pace === pace} onClick={() => update('pace', draft.pace === pace ? null : pace)}>
                    {t(PACE_KEY[pace])}
                  </Chip>
                ))}
              </ChipRail>
              <p className="mt-5 text-xs font-semibold text-ink-subtle">{t('budgetLabel')}</p>
              <ChipRail className="mt-2.5">
                {BUDGET_OPTIONS.map((budget) => (
                  <Chip
                    key={budget}
                    selected={draft.budgetComfort === budget}
                    onClick={() => update('budgetComfort', draft.budgetComfort === budget ? null : budget)}
                  >
                    {t(BUDGET_KEY[budget])}
                  </Chip>
                ))}
              </ChipRail>
            </fieldset>
          )}

          {step === 'contact' && (
            <fieldset className="min-w-0">
              <legend className="font-display text-xl font-bold text-sea-900">{t('stepContactTitle')}</legend>
              <p className="mt-1.5 text-sm text-ink-muted">{t('stepContactHint')}</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="full_name">{t('fullName')}</Label>
                  <Input
                    id="full_name"
                    autoComplete="name"
                    required
                    minLength={3}
                    maxLength={100}
                    value={draft.fullName}
                    onChange={(e) => update('fullName', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">{t('whatsapp')}</Label>
                  <Input
                    id="phone"
                    autoComplete="tel"
                    dir="ltr"
                    required
                    minLength={10}
                    maxLength={20}
                    value={draft.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="email">{t('email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    dir="ltr"
                    value={draft.email}
                    onChange={(e) => update('email', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
              <Turnstile onToken={setTurnstileToken} />
              {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
              <p className="mt-4 text-center text-xs text-ink-subtle sm:text-start">{t('notice')}</p>
            </fieldset>
          )}

          {/* Desktop nav — the sticky bar below covers mobile */}
          <div className="mt-8 hidden items-center justify-between gap-3 md:flex">
            <button
              type="button"
              onClick={goBack}
              disabled={stepIndex === 0}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink-muted transition-colors hover:bg-sand-100 disabled:pointer-events-none disabled:opacity-0"
            >
              <ArrowBack className="h-4 w-4" />
              {t('back')}
            </button>
            {isLastStep ? (
              <button
                type="button"
                onClick={submit}
                disabled={!canAdvance || submitting}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? t('sending') : t('submit')}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sea-900 px-6 text-sm font-semibold text-sand-50 transition-colors hover:bg-sea-700 disabled:opacity-40"
              >
                {t('next')}
                <ArrowForward className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live summary */}
        <aside className="hidden min-w-0 rounded-3xl border-[1.5px] border-sand-300 bg-sand-100 p-6 lg:block">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-ink-subtle">{t('buildSummaryTitle')}</h3>
          {summaryFacts.length === 0 ? (
            <p className="mt-3 text-sm text-ink-subtle">{t('buildSummaryEmpty')}</p>
          ) : (
            <ul className="mt-3 space-y-2.5">
              {summaryFacts.map((fact, i) => (
                <li key={i} className="text-sm leading-relaxed text-ink">{fact}</li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {/* Mobile sticky nav */}
      <div className="md:hidden">
        <StickyActionBar
          summary={
            stepIndex > 0 ? (
              <button type="button" onClick={goBack} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-ink-muted">
                <ArrowBack className="h-4 w-4" />
                {t('back')}
              </button>
            ) : null
          }
          action={
            isLastStep ? (
              <button
                type="button"
                onClick={submit}
                disabled={!canAdvance || submitting}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-on-accent disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? t('sending') : t('submit')}
              </button>
            ) : (
              <button
                type="button"
                onClick={goNext}
                disabled={!canAdvance}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sea-900 px-6 text-sm font-semibold text-sand-50 disabled:opacity-40"
              >
                {t('next')}
                <ArrowForward className="h-4 w-4" />
              </button>
            )
          }
        />
      </div>
    </div>
  )
}
