'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { MessageCircle, Check, Loader2 } from 'lucide-react'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { trackConversion, trackRequestFailure } from '@/lib/conversion'

interface TripPackageBookingFormProps {
  packageId: string
  packageNameAr: string
  packageNameEn: string
  whatsappNumber: string
}

interface FormState {
  customer_name: string
  customer_phone: string
  preferred_date: string
  num_people: number
  notes: string
}

/**
 * Direct booking/request form for a Trip Package — deliberately separate
 * from Book Dahab. A package request must land in trip_bookings (context =
 * 'package'), never in an accommodation/commerce booking flow.
 */
export function TripPackageBookingForm({ packageId, packageNameAr, packageNameEn, whatsappNumber }: TripPackageBookingFormProps) {
  const locale = useLocale()
  const ar = locale === 'ar'

  const [form, setForm] = useState<FormState>({
    customer_name: '',
    customer_phone: '',
    preferred_date: '',
    num_people: 1,
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const todayIso = new Date().toISOString().slice(0, 10)

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {}
    if (!form.customer_name.trim()) next.customer_name = ar ? 'من فضلك اكتب اسمك' : 'Please enter your name.'
    if (!form.customer_phone.trim()) next.customer_phone = ar ? 'من فضلك اكتب رقم هاتفك' : 'Please enter your phone number.'
    if (form.num_people < 1) next.num_people = ar ? 'شخص واحد على الأقل' : 'At least 1 person required.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (honeypot) return
    if (!validate()) return
    setSubmitting(true)
    setServerError('')
    try {
      const payload = {
        trip_package_id: packageId,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        preferred_date: form.preferred_date || undefined,
        num_people: form.num_people,
        notes: form.notes.trim() || undefined,
        website: honeypot,
        turnstile_token: turnstileToken || undefined,
      }
      const res = await fetch('/api/trip-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setServerError(data.error || (ar ? 'حصل خطأ، حاول تاني.' : 'Something went wrong. Please try again.'))
        trackRequestFailure('trip_package', 'server')
        return
      }
      trackConversion('trip_package_request_submitted', {
        content_type: 'trip_package',
        item_id: packageId,
        item_name: packageNameEn,
        source: 'package_detail',
      })
      setSubmitted(true)
    } catch {
      trackRequestFailure('trip_package', 'network')
      setServerError(ar ? 'حصل خطأ، حاول تاني.' : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappClean = whatsappNumber.replace(/[^0-9]/g, '')
  const packageName = ar ? packageNameAr : packageNameEn
  const waText = encodeURIComponent(
    ar
      ? `أريد الاستفسار عن باكدج: ${packageName}`
      : `I'd like to ask about the package: ${packageName}`,
  )

  if (submitted) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
          <Check className="h-5 w-5 text-emerald-700" aria-hidden="true" />
        </div>
        <p className="font-semibold text-emerald-800">{ar ? 'تم استلام طلبك' : 'Request received'}</p>
        <p className="mt-1 text-sm text-emerald-800">
          {ar ? 'هنتواصل معاك على واتساب لتأكيد التفاصيل والتوافر.' : 'WEEMAP will confirm the details and availability with you on WhatsApp.'}
        </p>
        <a
          href={`https://wa.me/${whatsappClean}?text=${waText}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackConversion('whatsapp_click', { source: 'trip_package', content_type: 'trip_package', item_id: packageId }, { once: false })}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-[#1FBE59]"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {ar ? 'افتح واتساب' : 'Open WhatsApp'}
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <h3 className="font-display text-base font-semibold text-sea-900">
        {ar ? 'احجز الباكدج' : 'Book this package'}
      </h3>
      <p className="text-xs leading-5 text-ink-muted">
        {ar
          ? 'ابعت طلبك وهنتواصل معاك لتأكيد التوافر والتفاصيل على واتساب.'
          : 'Send your request and WEEMAP will confirm availability and details with you on WhatsApp.'}
      </p>

      <div>
        <label htmlFor="pkg-book-name" className="mb-1 block text-xs font-medium text-sea-900">
          {ar ? 'اسمك' : 'Your name'}
        </label>
        <input
          id="pkg-book-name"
          type="text"
          autoComplete="name"
          value={form.customer_name}
          onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
          className="min-h-11 w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
          placeholder={ar ? 'اسمك الكامل' : 'Your full name'}
        />
        {errors.customer_name && <p className="mt-1 text-[11px] text-red-600">{errors.customer_name}</p>}
      </div>

      <div>
        <label htmlFor="pkg-book-phone" className="mb-1 block text-xs font-medium text-sea-900">
          {ar ? 'واتساب / رقم الهاتف' : 'WhatsApp / phone'}
        </label>
        <input
          id="pkg-book-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          dir="ltr"
          value={form.customer_phone}
          onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))}
          className="min-h-11 w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
          placeholder="+20 1xx xxx xxxx"
        />
        {errors.customer_phone && <p className="mt-1 text-[11px] text-red-600">{errors.customer_phone}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="pkg-book-people" className="mb-1 block text-xs font-medium text-sea-900">
            {ar ? 'عدد الأشخاص' : 'Number of people'}
          </label>
          <input
            id="pkg-book-people"
            type="number"
            min={1}
            max={50}
            inputMode="numeric"
            value={form.num_people}
            onChange={(e) => setForm((p) => ({ ...p, num_people: Math.max(1, parseInt(e.target.value) || 1) }))}
            className="min-h-11 w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
          />
          {errors.num_people && <p className="mt-1 text-[11px] text-red-600">{errors.num_people}</p>}
        </div>

        <div>
          <label htmlFor="pkg-book-date" className="mb-1 block text-xs font-medium text-sea-900">
            {ar ? 'التاريخ المفضل (اختياري)' : 'Preferred date (optional)'}
          </label>
          <input
            id="pkg-book-date"
            type="date"
            min={todayIso}
            value={form.preferred_date}
            onChange={(e) => setForm((p) => ({ ...p, preferred_date: e.target.value < todayIso ? todayIso : e.target.value }))}
            className="min-h-11 w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
          />
        </div>
      </div>

      <div>
        <label htmlFor="pkg-book-notes" className="mb-1 block text-xs font-medium text-sea-900">
          {ar ? 'ملاحظات' : 'Notes'}
        </label>
        <textarea
          id="pkg-book-notes"
          rows={3}
          maxLength={500}
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          placeholder={ar ? 'أسئلة، تفضيلات، طلبات خاصة…' : 'Questions, preferences, special requests…'}
          className="min-h-11 w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
        />
      </div>

      <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      <Turnstile onToken={setTurnstileToken} />

      {serverError && <p className="text-sm text-red-600">{serverError}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-500 text-base font-semibold text-on-accent transition-colors hover:bg-sun-600 disabled:cursor-not-allowed disabled:bg-sand-300 disabled:text-ink-subtle"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {ar ? 'جاري الإرسال…' : 'Sending…'}
          </>
        ) : (
          ar ? 'احجز الباكدج' : 'Book this package'
        )}
      </button>
    </form>
  )
}
