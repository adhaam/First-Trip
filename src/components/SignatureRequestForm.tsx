'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { trackConversion, trackRequestFailure } from '@/lib/conversion'

export function SignatureRequestForm({ experienceId }: { experienceId?: string }) {
  const t = useTranslations('signature')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (honeypot) return // silently drop — bot filled the hidden field
    setSubmitting(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const payload = {
      experience_id: experienceId,
      full_name: String(form.get('full_name') || ''),
      phone: String(form.get('phone') || ''),
      email: String(form.get('email') || '') || undefined,
      preferred_date: String(form.get('preferred_date') || '') || undefined,
      spots_requested: Number(form.get('spots_requested')) || 1,
      interests: String(form.get('interests') || ''),
      duration_preference: String(form.get('duration_preference') || ''),
      notes: String(form.get('notes') || ''),
      website: honeypot,
      turnstile_token: turnstileToken || undefined,
    }
    try {
      const res = await fetch('/api/experience-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      trackConversion(
        experienceId ? 'signature_request_submitted' : 'build_signature_request_submitted',
        { content_type: 'signature', item_id: experienceId || 'custom', source: 'signature' },
      )
      setSubmitted(true)
    } catch {
      trackRequestFailure('signature', 'network')
      setError(t('requestFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">{t('requestSent')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="full_name">{t('fullName')}</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required minLength={3} maxLength={100} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="phone">{t('whatsapp')}</Label>
          <Input id="phone" name="phone" autoComplete="tel" dir="ltr" required minLength={10} maxLength={20} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" autoComplete="email" type="email" dir="ltr" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="preferred_date">{t('preferredDate')}</Label>
          <Input id="preferred_date" name="preferred_date" type="date" className="mt-1" />
        </div>
        <div>
          <Label htmlFor="spots_requested">{t('travelers')}</Label>
          <Input id="spots_requested" name="spots_requested" type="number" min={1} max={50} defaultValue={2} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="duration_preference">{t('durationPreference')}</Label>
          <Input id="duration_preference" name="duration_preference" maxLength={200} className="mt-1" />
        </div>
      </div>
      <div>
        <Label htmlFor="interests">{t('interests')}</Label>
        <Textarea id="interests" name="interests" rows={2} maxLength={500} className="mt-1" />
      </div>
      <div>
        <Label htmlFor="notes">{t('notes')}</Label>
        <Textarea id="notes" name="notes" rows={4} maxLength={1000} className="mt-1" />
      </div>
      <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      <Turnstile onToken={setTurnstileToken} />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button type="submit" variant="primary" size="touch-lg" disabled={submitting} className="w-full rounded-full">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        {submitting ? t('sending') : t('submit')}
      </Button>
      <p className="text-center text-xs text-ink-subtle">{ar ? 'ده طلب مبدئي — مفيش تأكيد فوري.' : "This is a request, not an instant confirmation."}</p>
    </form>
  )
}
