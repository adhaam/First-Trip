'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname } from 'next/navigation'
import {
  AlertCircle,
  ArrowUpRight,
  Compass,
  Loader2,
  MessageCircle,
  RotateCcw,
  Send,
  Sparkles,
} from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

const SESSION_KEY = 'weemap-ai-session-v1'
const LEAD_KEY = 'weemap-ai-lead-v1'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type PageType = 'home' | 'trips' | 'trip' | 'stays' | 'accommodation' | 'community' | 'article' | 'other'

interface PageContext {
  url: string
  type: PageType
  entityId?: string
}

interface ChatMessage {
  id: string
  role: 'assistant' | 'user'
  content: string
}

interface LeadFields {
  name: string
  whatsapp: string
  email: string
}

type LeadFieldErrors = Partial<Record<keyof LeadFields, string>>

function getPageContext(pathname: string): PageContext {
  const route = pathname.replace(/^\/en(?=\/|$)/, '') || '/'
  const parts = route.split('/').filter(Boolean)
  let type: PageType = 'other'
  let entityId: string | undefined

  if (route === '/') type = 'home'
  else if (parts[0] === 'sinai-trips') {
    type = parts[1] ? 'trip' : 'trips'
    entityId = parts[1]
  } else if (parts[0] === 'book-dahab') {
    type = parts[1] ? 'accommodation' : 'stays'
    entityId = parts[1]
  } else if (parts[0] === 'community') {
    type = parts[1] ? 'article' : 'community'
    entityId = parts[1]
  }

  return {
    url: typeof window === 'undefined' ? route : window.location.href,
    type,
    ...(entityId ? { entityId } : {}),
  }
}

function validateLead(fields: LeadFields, messages: (key: string) => string): LeadFieldErrors {
  const errors: LeadFieldErrors = {}
  const name = fields.name.trim()
  const phone = fields.whatsapp.replace(/[\s().-]/g, '')

  if (!name) errors.name = messages('nameRequired')
  else if (name.length < 2) errors.name = messages('nameShort')

  if (!phone) errors.whatsapp = messages('phoneRequired')
  else if (!/^\+?[0-9]{7,15}$/.test(phone)) errors.whatsapp = messages('phoneInvalid')

  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
    errors.email = messages('emailInvalid')
  }

  return errors
}

function HumanHandoff({ number, label }: { number?: string | null; label: string }) {
  const digits = (number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-sea-900/15 bg-white px-4 text-center text-sm font-semibold text-sea-900 transition-colors hover:border-sea-900/30 hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500"
    >
      <MessageCircle className="h-4 w-4 text-[#1b9a50]" aria-hidden />
      {label}
      <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
    </a>
  )
}

export function WeemapAI({
  whatsappNumber,
  chatAvailable,
}: {
  whatsappNumber?: string | null
  chatAvailable: boolean
}) {
  const locale = useLocale() as 'ar' | 'en'
  const t = useTranslations('askWeemap')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [leadReady, setLeadReady] = useState(false)
  const [lead, setLead] = useState<LeadFields>({ name: '', whatsapp: '', email: '' })
  const [leadErrors, setLeadErrors] = useState<LeadFieldErrors>({})
  const [leadError, setLeadError] = useState('')
  const [submittingLead, setSubmittingLead] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const messageEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY)
    const nextSessionId = stored && UUID_PATTERN.test(stored) ? stored : crypto.randomUUID()
    if (stored !== nextSessionId) window.localStorage.setItem(SESSION_KEY, nextSessionId)
    const ready = chatAvailable && window.localStorage.getItem(LEAD_KEY) === nextSessionId

    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate the anonymous browser session after mount
    setSessionId(nextSessionId)
    setLeadReady(ready)
    if (ready) {
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: t('welcomeGeneric') }])
    }
    setInitialized(true)
  }, [chatAvailable, t])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, sending])

  useEffect(() => {
    if (open && leadReady) window.setTimeout(() => composerRef.current?.focus(), 200)
  }, [leadReady, open])

  const updateLead = (field: keyof LeadFields, value: string) => {
    setLead(current => ({ ...current, [field]: value }))
    setLeadErrors(current => ({ ...current, [field]: undefined }))
    setLeadError('')
  }

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!chatAvailable) return
    const errors = validateLead(lead, t)
    setLeadErrors(errors)
    setLeadError('')
    if (Object.keys(errors).length || !sessionId) return

    setSubmittingLead(true)
    try {
      const response = await fetch('/api/ai/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          name: lead.name,
          whatsapp: lead.whatsapp,
          email: lead.email,
          locale,
          initialPageUrl: window.location.href,
        }),
      })

      if (!response.ok) throw new Error('Lead request failed')

      window.localStorage.setItem(LEAD_KEY, sessionId)
      const firstName = lead.name.trim().split(/\s+/)[0]
      setMessages([{ id: crypto.randomUUID(), role: 'assistant', content: t('welcomeNamed', { name: firstName }) }])
      setLeadReady(true)
    } catch {
      setLeadError(t('leadFailed'))
    } finally {
      setSubmittingLead(false)
    }
  }

  const sendMessage = useCallback(async (content: string, appendUser = true) => {
    const message = content.trim()
    if (!message || !sessionId || sending || !chatAvailable) return

    if (appendUser) {
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'user', content: message }])
    }
    setDraft('')
    setSending(true)
    setSendError('')
    setFailedMessage('')

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message,
          locale,
          page: getPageContext(pathname),
        }),
      })
      const data = await response.json().catch(() => null)

      if (response.status === 404 && data?.error?.code === 'SESSION_NOT_FOUND') {
        window.localStorage.removeItem(LEAD_KEY)
        setLeadReady(false)
        setMessages([])
        setLeadError(t('sessionExpired'))
        return
      }
      if (!response.ok || typeof data?.message !== 'string') {
        setSendError(response.status === 503 ? t('unavailableDescription') : t('networkError'))
        setFailedMessage(message)
        return
      }

      setMessages(current => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message,
      }])
    } catch {
      setSendError(t('networkError'))
      setFailedMessage(message)
    } finally {
      setSending(false)
    }
  }, [chatAvailable, locale, pathname, sending, sessionId, t])

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void sendMessage(draft)
    }
  }

  const isAdminRoute = pathname === '/admin'
    || pathname.startsWith('/admin/')
    || pathname === '/en/admin'
    || pathname.startsWith('/en/admin/')

  if (isAdminRoute) return null

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        className={`group fixed z-50 inline-flex min-h-12 items-center gap-2 rounded-full bg-sun-500 px-4 text-sm font-bold text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)] transition-all hover:bg-sun-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sea-900 ${locale === 'ar' ? 'left-5' : 'right-5'}`}
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <Sparkles className="h-5 w-5" aria-hidden />
        <span>{t('trigger')}</span>
      </SheetTrigger>

      <SheetContent
        side={locale === 'ar' ? 'left' : 'right'}
        closeLabel={t('close')}
        className="gap-0 overflow-hidden border-sea-900/10 bg-sand-50 p-0 text-sea-900 shadow-2xl [&_[data-slot=sheet-close]]:text-white [&_[data-slot=sheet-close]]:hover:bg-white/10"
        style={{ width: 'min(100%, 28rem)', maxWidth: 'none', height: '100dvh' }}
      >
        <SheetHeader className="shrink-0 border-b border-white/10 bg-sea-900 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))] pe-14 text-start text-white">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-sun-500 text-white" aria-hidden>
              <Compass className="h-5 w-5" />
            </span>
            <div>
              <SheetTitle className="font-display text-lg font-bold text-white">{t('title')}</SheetTitle>
              <SheetDescription className="text-sm text-sand-100/70">{t('subtitle')}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {!initialized ? (
          <div className="flex flex-1 items-center justify-center" role="status">
            <Loader2 className="h-6 w-6 animate-spin text-sun-500" />
            <span className="sr-only">{t('submitting')}</span>
          </div>
        ) : !leadReady ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            <div className="mx-auto max-w-sm">
              <span className="eyebrow text-sun-600">WEEMAP SINAI</span>
              <h2 className="mt-4 font-display text-2xl font-extrabold text-sea-900">{t('welcomeTitle')}</h2>
              <p className="mt-2 text-sm leading-relaxed text-sea-900/65">{t('welcomeDescription')}</p>

              {!chatAvailable && (
                <div className="mt-5 flex gap-3 rounded-xl border border-sun-500/25 bg-sun-100/70 p-3 text-sm leading-relaxed text-sea-900/75">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sun-600" aria-hidden />
                  <p>{t('availabilityLead')}</p>
                </div>
              )}

              {chatAvailable && <form className="mt-6 space-y-4" onSubmit={submitLead} noValidate>
                <div>
                  <Label htmlFor="weemap-ai-name">{t('nameLabel')} <span aria-hidden className="text-sun-600">*</span></Label>
                  <Input
                    id="weemap-ai-name"
                    autoComplete="name"
                    value={lead.name}
                    onChange={event => updateLead('name', event.target.value)}
                    placeholder={t('namePlaceholder')}
                    aria-invalid={Boolean(leadErrors.name)}
                    aria-describedby={leadErrors.name ? 'weemap-ai-name-error' : undefined}
                    className="mt-1.5 min-h-12 bg-white"
                  />
                  {leadErrors.name && <p id="weemap-ai-name-error" className="mt-1 text-xs text-red-700" role="alert">{leadErrors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="weemap-ai-phone">{t('whatsappLabel')} <span aria-hidden className="text-sun-600">*</span></Label>
                  <Input
                    id="weemap-ai-phone"
                    type="tel"
                    dir="ltr"
                    autoComplete="tel"
                    inputMode="tel"
                    value={lead.whatsapp}
                    onChange={event => updateLead('whatsapp', event.target.value)}
                    placeholder={t('phonePlaceholder')}
                    aria-invalid={Boolean(leadErrors.whatsapp)}
                    aria-describedby={leadErrors.whatsapp ? 'weemap-ai-phone-error' : undefined}
                    className="mt-1.5 min-h-12 bg-white text-start"
                  />
                  {leadErrors.whatsapp && <p id="weemap-ai-phone-error" className="mt-1 text-xs text-red-700" role="alert">{leadErrors.whatsapp}</p>}
                </div>

                <div>
                  <Label htmlFor="weemap-ai-email">{t('emailLabel')} <span className="font-normal text-sea-900/45">({t('optional')})</span></Label>
                  <Input
                    id="weemap-ai-email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    inputMode="email"
                    value={lead.email}
                    onChange={event => updateLead('email', event.target.value)}
                    placeholder={t('emailPlaceholder')}
                    aria-invalid={Boolean(leadErrors.email)}
                    aria-describedby={leadErrors.email ? 'weemap-ai-email-error' : undefined}
                    className="mt-1.5 min-h-12 bg-white text-start"
                  />
                  {leadErrors.email && <p id="weemap-ai-email-error" className="mt-1 text-xs text-red-700" role="alert">{leadErrors.email}</p>}
                </div>

                {leadError && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800" role="alert">{leadError}</p>}

                <Button type="submit" disabled={submittingLead || !sessionId} className="min-h-12 w-full rounded-xl bg-sun-500 px-5 font-bold text-white hover:bg-sun-600">
                  {submittingLead ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                  {submittingLead ? t('submitting') : t('startChatting')}
                </Button>

                <p className="text-xs leading-relaxed text-sea-900/55">
                  {t('privacyBefore')}{' '}
                  <Link href="/policy" onClick={() => setOpen(false)} className="font-semibold text-sea-700 underline underline-offset-2 hover:text-sun-600">
                    {t('privacyLink')}
                  </Link>
                  {t('privacyAfter')}
                </p>
              </form>}

              <div className="mt-5 border-t border-sea-900/10 pt-5">
                <HumanHandoff number={whatsappNumber} label={t('humanWhatsApp')} />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-sea-900/10 bg-white/70 px-4 py-3">
              <HumanHandoff number={whatsappNumber} label={t('humanWhatsApp')} />
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5" role="log" aria-live="polite" aria-label={t('title')}>
              {messages.length === 0 && <p className="py-10 text-center text-sm text-sea-900/50">{t('empty')}</p>}
              <div className="space-y-4">
                {messages.map(message => (
                  <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end rtl:justify-start' : 'justify-start rtl:justify-end'}`}>
                    <div className={`max-w-[85%] break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === 'user' ? 'rounded-br-sm bg-sun-500 text-white rtl:rounded-bl-sm rtl:rounded-br-2xl' : 'rounded-bl-sm border border-sea-900/10 bg-white text-sea-900 rtl:rounded-br-sm rtl:rounded-bl-2xl'}`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start rtl:justify-end" role="status" aria-label={t('typing')}>
                    <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-sea-900/10 bg-white px-4 py-3 rtl:rounded-br-sm rtl:rounded-bl-2xl">
                      {[0, 1, 2].map(index => <span key={index} className="h-1.5 w-1.5 animate-pulse rounded-full bg-sun-500" style={{ animationDelay: `${index * 140}ms` }} />)}
                    </div>
                  </div>
                )}
                <div ref={messageEndRef} />
              </div>
            </div>

            <div className="shrink-0 border-t border-sea-900/10 bg-sand-50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              {!chatAvailable && (
                <div className="mb-3 rounded-xl border border-sun-500/25 bg-sun-100/70 p-3" role="status">
                  <p className="font-semibold text-sea-900">{t('unavailableTitle')}</p>
                  <p className="mt-1 text-xs leading-relaxed text-sea-900/65">{t('unavailableDescription')}</p>
                </div>
              )}

              {sendError && (
                <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
                  <span>{sendError}</span>
                  {failedMessage && (
                    <button type="button" onClick={() => void sendMessage(failedMessage, false)} className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2">
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                      {t('retry')}
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-end gap-2">
                <Label htmlFor="weemap-ai-message" className="sr-only">{t('messageLabel')}</Label>
                <Textarea
                  ref={composerRef}
                  id="weemap-ai-message"
                  rows={1}
                  maxLength={1000}
                  value={draft}
                  disabled={!chatAvailable || sending}
                  onChange={event => setDraft(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={t('messagePlaceholder')}
                  className="max-h-32 min-h-12 resize-none bg-white py-3"
                />
                <Button
                  type="button"
                  disabled={!chatAvailable || sending || !draft.trim()}
                  onClick={() => void sendMessage(draft)}
                  aria-label={t('send')}
                  className="h-12 w-12 rounded-xl bg-sun-500 p-0 text-white hover:bg-sun-600"
                >
                  {sending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Send className="h-5 w-5 rtl:-scale-x-100" aria-hidden />}
                  <span className="sr-only">{sending ? t('sending') : t('send')}</span>
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
