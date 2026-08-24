'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, Loader2, MessageCircle } from 'lucide-react'
import { formatDateRange, formatPrice, type ExperienceDateWithAvailability } from '@/lib/experiences'

interface ExperienceBookingFormProps {
  date: ExperienceDateWithAvailability
  experienceTitle: string
  price: number
  currency: string
  whatsappNumber: string
  onBooked?: (spotsRemaining: number) => void
}

interface FormState {
  full_name: string
  phone: string
  email: string
  spots_requested: number
  notes: string
  agreed: boolean
}

const EMPTY: FormState = {
  full_name: '',
  phone: '',
  email: '',
  spots_requested: 1,
  notes: '',
  agreed: false,
}

export function ExperienceBookingForm({
  date,
  experienceTitle,
  price,
  currency,
  whatsappNumber,
  onBooked,
}: ExperienceBookingFormProps) {
  const t = useTranslations('experiences')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')

  const maxSpots = Math.min(date.spots_remaining, 20)
  const waText = encodeURIComponent(
    ar
      ? `طلب حجز تجربة: ${experienceTitle} — ${date.start_date}`
      : `Booking request for: ${experienceTitle} — ${date.start_date}`,
  )
  const waHref = `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${waText}`

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (form.full_name.trim().length < 3) next.full_name = t('errName')
    if (form.phone.trim().length < 8) next.phone = t('errPhone')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = t('errEmail')
    if (form.spots_requested < 1 || form.spots_requested > maxSpots) {
      next.spots_requested = t('errSpots', { max: maxSpots })
    }
    if (!form.agreed) next.agreed = t('errAgree')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setServerError('')
    try {
      const res = await fetch('/api/experience-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          experience_date_id: date.id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim(),
          spots_requested: form.spots_requested,
          notes: form.notes.trim(),
          agreed: true,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setServerError(data.error || t('errSubmit'))
        return
      }
      setSubmitted(true)
      if (typeof data.spots_remaining === 'number') onBooked?.(data.spots_remaining)
    } catch {
      setServerError(t('errSubmit'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
          <Check className="h-5 w-5 text-green-700" aria-hidden="true" />
        </div>
        <p className="font-display text-base font-semibold text-green-900">{t('successTitle')}</p>
        <p className="mt-2 text-sm leading-6 text-green-800">{t('successBody')}</p>
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-green-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t('openWhatsApp')}
        </a>
      </div>
    )
  }

  const fieldClass =
    'w-full rounded-lg border border-sand-300 bg-white px-3 py-2.5 text-sm text-sea-900 placeholder:text-sea-900/40 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500'

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="rounded-lg bg-sand-100 px-4 py-3 text-sm text-sea-900/80">
        <p className="font-semibold text-sea-900">{formatDateRange(date.start_date, date.end_date, locale)}</p>
        <p className="mt-0.5">
          {t('spotsLeft', { count: date.spots_remaining })} · {formatPrice(price, currency, locale)} {t('perPersonInline')}
        </p>
      </div>

      <div>
        <label htmlFor={`exp-name-${date.id}`} className="mb-1 block text-xs font-medium text-sea-900">
          {t('fieldName')} *
        </label>
        <input
          id={`exp-name-${date.id}`}
          type="text"
          autoComplete="name"
          value={form.full_name}
          onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
          className={fieldClass}
          placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
        />
        {errors.full_name && <p className="mt-1 text-[11px] text-red-600">{errors.full_name}</p>}
      </div>

      <div>
        <label htmlFor={`exp-phone-${date.id}`} className="mb-1 block text-xs font-medium text-sea-900">
          {t('fieldPhone')} *
        </label>
        <input
          id={`exp-phone-${date.id}`}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={form.phone}
          onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
          className={fieldClass}
          placeholder="+20 1xx xxx xxxx"
        />
        <p className="mt-1 text-[11px] text-sea-900/55">{t('phoneHint')}</p>
        {errors.phone && <p className="mt-1 text-[11px] text-red-600">{errors.phone}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`exp-email-${date.id}`} className="mb-1 block text-xs font-medium text-sea-900">
            {t('fieldEmail')} *
          </label>
          <input
            id={`exp-email-${date.id}`}
            type="email"
            autoComplete="email"
            dir="ltr"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            className={fieldClass}
            placeholder="you@example.com"
          />
          {errors.email && <p className="mt-1 text-[11px] text-red-600">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor={`exp-spots-${date.id}`} className="mb-1 block text-xs font-medium text-sea-900">
            {t('fieldSpots')} *
          </label>
          <input
            id={`exp-spots-${date.id}`}
            type="number"
            min={1}
            max={maxSpots}
            inputMode="numeric"
            value={form.spots_requested}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                spots_requested: Math.min(Math.max(1, parseInt(e.target.value) || 1), maxSpots),
              }))
            }
            className={fieldClass}
          />
          {errors.spots_requested && (
            <p className="mt-1 text-[11px] text-red-600">{errors.spots_requested}</p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor={`exp-notes-${date.id}`} className="mb-1 block text-xs font-medium text-sea-900">
          {t('fieldNotes')}
        </label>
        <textarea
          id={`exp-notes-${date.id}`}
          rows={3}
          maxLength={600}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          className={fieldClass}
          placeholder={t('notesPlaceholder')}
        />
      </div>

      <label className="flex items-start gap-3 rounded-lg bg-sand-50 p-3 text-xs leading-6 text-sea-900/80">
        <input
          type="checkbox"
          checked={form.agreed}
          onChange={(e) => setForm((p) => ({ ...p, agreed: e.target.checked }))}
          className="mt-1 h-4 w-4 shrink-0 rounded border-sand-400 text-sea-700 focus:ring-sea-500"
        />
        <span>{t('agreement')}</span>
      </label>
      {errors.agreed && <p className="text-[11px] text-red-600">{errors.agreed}</p>}

      {serverError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-sun-600 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('submitting')}
          </>
        ) : (
          t('requestBooking')
        )}
      </button>
    </form>
  )
}
