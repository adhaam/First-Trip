'use client'

import { useTranslations } from 'next-intl'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { contactErrors } from '@/lib/trip-builder/contact'
import type { BuilderState } from '@/lib/trip-builder/types'
import { cn } from '@/lib/utils'
import { fieldClass, TextField } from './controls'

/** Section 9 — contact & request: the only step whose fields leave the browser (on submit). */
export function ContactStep({
  state,
  honeypot,
  submitError,
  submitting,
  touched,
  onChange,
  onNotes,
  onHoneypot,
  onTurnstile,
}: {
  state: BuilderState
  honeypot: string
  submitError: string
  submitting: boolean
  /** Only show field errors once the visitor has tried to move on / submit. */
  touched: boolean
  onChange: (contact: Partial<NonNullable<BuilderState['contact']>>) => void
  onNotes: (notes: string) => void
  onHoneypot: (value: string) => void
  onTurnstile: (token: string | null) => void
}) {
  const t = useTranslations('builder')
  const errors = touched ? contactErrors(state.contact ?? {}) : {}

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t('name')} value={state.contact?.name ?? ''} onChange={(name) => onChange({ name })} error={errors.name ? t('errorName') : undefined} required autoComplete="name" />
        <TextField label={t('phone')} type="tel" value={state.contact?.phone ?? ''} onChange={(phone) => onChange({ phone })} placeholder={t('phonePlaceholder')} error={errors.phone ? t('errorPhone') : undefined} required autoComplete="tel" />
      </div>
      <TextField label={t('email')} type="email" value={state.contact?.email ?? ''} onChange={(email) => onChange({ email })} error={errors.email ? t('errorEmail') : undefined} autoComplete="email" />
      <label className="block text-sm font-semibold text-sea-900">
        {t('notes')}
        <textarea value={state.notes ?? ''} onChange={(event) => onNotes(event.target.value)} placeholder={t('notesPlaceholder')} rows={3} className={cn(fieldClass, 'py-2.5')} />
      </label>

      <HoneypotField value={honeypot} onChange={(event) => onHoneypot(event.target.value)} />
      <Turnstile onToken={onTurnstile} />

      <p className="text-xs text-ink-subtle">{t('privacyNote')}</p>

      {submitError && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="min-h-12 w-full rounded-full bg-sun-500 px-5 font-display text-base font-bold text-on-accent transition-colors hover:bg-sun-600 disabled:opacity-60"
      >
        {submitting ? t('sending') : t('sendRequest')}
      </button>
    </div>
  )
}
