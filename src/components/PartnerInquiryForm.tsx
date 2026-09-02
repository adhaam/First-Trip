'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Loader2, Send, CheckCircle2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { trackConversion } from '@/lib/conversion'

const PARTNERSHIP_TYPES = ['hotel', 'experience', 'transport', 'other'] as const

export function PartnerInquiryForm() {
  const t = useTranslations('partner')

  const [partnershipType, setPartnershipType] = useState('')
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
      name: String(form.get('name') || ''),
      business_name: String(form.get('business_name') || '') || undefined,
      phone: String(form.get('phone') || ''),
      email: String(form.get('email') || '') || undefined,
      partnership_type: partnershipType || undefined,
      message: String(form.get('message') || ''),
      website: honeypot,
      turnstile_token: turnstileToken || undefined,
    }
    try {
      const res = await fetch('/api/partner-inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error()
      trackConversion('partner_inquiry_submitted', {
        content_type: 'partner',
        partnership_type: partnershipType || 'unspecified',
        source: 'partner_page',
      })
      setSubmitted(true)
    } catch {
      setError(t('formError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-relaxed">{t('formSuccess')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="partner-name">{t('formName')}</Label>
          <Input id="partner-name" name="name" autoComplete="name" required minLength={2} maxLength={100} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="partner-business_name">{t('formBusinessName')}</Label>
          <Input id="partner-business_name" name="business_name" autoComplete="organization" maxLength={150} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="partner-phone">{t('formPhone')}</Label>
          <Input id="partner-phone" name="phone" autoComplete="tel" dir="ltr" required minLength={6} maxLength={20} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="partner-email">{t('formEmail')}</Label>
          <Input id="partner-email" name="email" autoComplete="email" type="email" dir="ltr" className="mt-1" />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="partner-type">{t('formType')}</Label>
          <Select value={partnershipType} onValueChange={(v) => setPartnershipType(v || '')}>
            <SelectTrigger id="partner-type" className="mt-1">
              <SelectValue placeholder={t('formTypePlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {PARTNERSHIP_TYPES.map((type) => (
                <SelectItem key={type} value={type}>{t(`formType_${type}`)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label htmlFor="partner-message">{t('formMessage')}</Label>
        <Textarea id="partner-message" name="message" required minLength={10} maxLength={1000} rows={5} className="mt-1" />
      </div>
      <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      <Turnstile onToken={setTurnstileToken} />
      {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      <Button type="submit" variant="primary" size="touch-lg" disabled={submitting} className="w-full rounded-full">
        {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        {submitting ? t('formSending') : t('formSubmit')}
      </Button>
      <p className="text-center text-xs text-ink-subtle">{t('formNote')}</p>
    </form>
  )
}
