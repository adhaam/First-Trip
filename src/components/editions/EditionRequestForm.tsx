'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCircle2, Loader2, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import type { EditionRequestIntent } from '@/lib/editions'

type Props = {
  editionId: string
  intent: EditionRequestIntent
  locale: 'en' | 'ar'
}

/** Posts to /api/edition-requests — never claims a "booking", only a request. */
export function EditionRequestForm({ editionId, intent, locale }: Props) {
  const t = useTranslations('editions')

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (honeypot) return
    setSubmitting(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const payload = {
      edition_id: editionId,
      intent,
      locale,
      customer_name: String(form.get('customer_name') || ''),
      phone: String(form.get('phone') || ''),
      email: String(form.get('email') || '') || undefined,
      travelers: Number(form.get('travelers')) || undefined,
      requested_start_date: String(form.get('requested_start_date') || '') || undefined,
      message: String(form.get('message') || '') || undefined,
      website: honeypot,
      turnstile_token: turnstileToken || undefined,
    }
    try {
      const res = await fetch('/api/edition-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      setSubmitted(true)
    } catch {
      setError(t('requestForm.submit'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">{t('requestForm.successTitle')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customer_name">{t('requestForm.customerName')}</Label>
          <Input
            id="customer_name"
            name="customer_name"
            autoComplete="name"
            required
            minLength={2}
            maxLength={100}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="phone">{t('requestForm.phone')}</Label>
          <Input
            id="phone"
            name="phone"
            autoComplete="tel"
            dir="ltr"
            required
            minLength={6}
            maxLength={20}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="email">{t('requestForm.email')}</Label>
          <Input id="email" name="email" autoComplete="email" type="email" dir="ltr" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="travelers">{t('requestForm.travelers')}</Label>
          <Input id="travelers" name="travelers" type="number" min={1} max={50} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="requested_start_date">{t('requestForm.requestedStartDate')}</Label>
          <Input id="requested_start_date" name="requested_start_date" type="date" className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="message">{t('requestForm.message')}</Label>
        <Textarea id="message" name="message" rows={3} maxLength={1000} className="mt-1" />
      </div>

      <Turnstile onToken={setTurnstileToken} />
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {t('requestForm.submit')}
      </Button>
    </form>
  )
}
