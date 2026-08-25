'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { MessageCircle, Check, Loader2 } from 'lucide-react'

interface TripBookingFormProps {
  tripId: string
  tripNameAr: string
  tripNameEn: string
  whatsappNumber: string
}

interface FormState {
  customer_name: string
  customer_phone: string
  preferred_date: string
  num_people: number
  notes: string
  promo_code: string
}

export function TripBookingForm({ tripId, tripNameAr, tripNameEn, whatsappNumber }: TripBookingFormProps) {
  const t = useTranslations('tripDetail')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [form, setForm] = useState<FormState>({
    customer_name: '',
    customer_phone: '',
    preferred_date: '',
    num_people: 1,
    notes: '',
    promo_code: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')

  const todayIso = new Date().toISOString().slice(0, 10)

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.customer_name.trim()) next.customer_name = t('bookNameRequired')
    if (!form.customer_phone.trim()) next.customer_phone = t('bookPhoneRequired')
    if (form.num_people < 1) next.num_people = t('bookPeopleMin')
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    setServerError('')
    try {
      const payload = {
        trip_id: tripId,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        preferred_date: form.preferred_date || undefined,
        num_people: form.num_people,
        notes: form.notes.trim() || undefined,
        promo_code: form.promo_code.trim() || undefined,
      }
      const res = await fetch('/api/trip-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setServerError(data.error || t('bookError'))
        return
      }
      setSubmitted(true)
    } catch {
      setServerError(t('bookError'))
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappClean = whatsappNumber.replace(/[^0-9]/g, '')
  const tripName = ar ? tripNameAr : tripNameEn
  const waText = encodeURIComponent(
    ar
      ? `أريد الاستفسار عن رحلة: ${tripName}`
      : `I'd like to ask about the trip: ${tripName}`,
  )

  if (submitted) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
          <Check className="h-5 w-5 text-green-600" aria-hidden="true" />
        </div>
        <p className="font-semibold text-green-800">{t('bookSuccess')}</p>
        <p className="mt-1 text-sm text-green-700">{t('bookSuccessText')}</p>
        <a
          href={`https://wa.me/${whatsappClean}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md bg-green-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t('bookWhatsApp')}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h3 className="font-display text-base font-semibold text-sea-900">{t('bookForm')}</h3>
      <p className="text-xs leading-5 text-sea-900/60">{t('bookFormHint')}</p>

      <div>
        <label htmlFor="trip-book-name" className="mb-1 block text-xs font-medium text-sea-900">
          {t('bookName')}
        </label>
        <input
          id="trip-book-name"
          type="text"
          autoComplete="name"
          value={form.customer_name}
          onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
          className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-sea-900/40 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
          placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
        />
        {errors.customer_name && <p className="mt-1 text-[11px] text-red-600">{errors.customer_name}</p>}
      </div>

      <div>
        <label htmlFor="trip-book-phone" className="mb-1 block text-xs font-medium text-sea-900">
          {t('bookPhone')}
        </label>
        <input
          id="trip-book-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={form.customer_phone}
          onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))}
          className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-sea-900/40 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
          placeholder="+20 1xx xxx xxxx"
        />
        {errors.customer_phone && <p className="mt-1 text-[11px] text-red-600">{errors.customer_phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="trip-book-people" className="mb-1 block text-xs font-medium text-sea-900">
            {t('bookPeople')}
          </label>
          <input
            id="trip-book-people"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={form.num_people}
            onChange={(e) => setForm((p) => ({ ...p, num_people: Math.max(1, parseInt(e.target.value) || 1) }))}
            className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
          />
          {errors.num_people && <p className="mt-1 text-[11px] text-red-600">{errors.num_people}</p>}
        </div>

        <div>
          <label htmlFor="trip-book-date" className="mb-1 block text-xs font-medium text-sea-900">
            {t('bookDateOptional')}
          </label>
          <input
            id="trip-book-date"
            type="date"
            min={todayIso}
            value={form.preferred_date}
            onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value < todayIso ? todayIso : e.target.value }))}
            className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor="trip-book-promo" className="mb-1 block text-xs font-medium text-sea-900">
          {ar ? 'كود الخصم (اختياري)' : 'Promo code (optional)'}
        </label>
        <input
          id="trip-book-promo"
          type="text"
          dir="ltr"
          value={form.promo_code}
          onChange={(e) => setForm((p) => ({ ...p, promo_code: e.target.value }))}
          className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm uppercase text-sea-900 placeholder:text-sea-900/40 placeholder:normal-case focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
          placeholder={ar ? 'إن وجد' : 'If you have one'}
        />
      </div>

      <div>
        <label htmlFor="trip-book-notes" className="mb-1 block text-xs font-medium text-sea-900">
          {t('bookNotes')}
        </label>
        <textarea
          id="trip-book-notes"
          rows={3}
          maxLength={500}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder={t('bookNotesPlaceholder')}
          className="w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-sea-900/40 focus:border-sea-500 focus:outline-none focus:ring-1 focus:ring-sea-500"
        />
      </div>

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-sea-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-sea-800 disabled:opacity-60"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('bookSubmitting')}
          </>
        ) : (
          t('bookSubmit')
        )}
      </button>
    </form>
  )
}
