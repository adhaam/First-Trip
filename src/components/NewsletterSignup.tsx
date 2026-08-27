'use client'

import { useState, type FormEvent } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { Mail, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'

/**
 * Email capture — the "stay in the loop" band above the footer.
 * Deliberately warm and community-flavoured, not "subscribe to our newsletter".
 * Adham wants leads, but wants them to feel invited into a group, not marketed to.
 */
export function NewsletterSignup() {
  const t = useTranslations('home')
  const common = useTranslations('common')
  const locale = useLocale()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (honeypot) return // silently drop — bot filled the hidden field
    if (!email || !email.includes('@')) return
    setState('loading')
    setErrMsg('')
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, locale, source: 'homepage-footer', website: honeypot, turnstile_token: turnstileToken || undefined,
        }),
      })
      if (!res.ok) {
        setState('err')
        setErrMsg(t('newsletterError'))
        return
      }
      setState('ok')
    } catch {
      setState('err')
      setErrMsg(t('newsletterNetworkError'))
    }
  }

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-sea-800 via-sea-700 to-sea-900 py-16 text-white md:py-20">
      <div
        aria-hidden
        className="absolute -end-24 -top-24 h-72 w-72 rounded-full border-[3rem] border-sun-400/15"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -start-24 h-80 w-80 rounded-full border-[2.5rem] border-white/8"
      />

      <div className="container-main relative">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-sun-300 backdrop-blur">
              <Mail className="h-3.5 w-3.5" />
              {t('newsletterTitle')}
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h2 className="font-display text-3xl font-bold leading-tight sm:text-4xl md:text-[2.6rem]">
              {t('newsletterTitle')}
            </h2>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75 md:text-lg">
              {t('newsletterSub')}
            </p>
          </Reveal>

          <Reveal delay={240}>
            {state === 'ok' ? (
              <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-500/15 px-6 py-4 text-sm font-semibold text-white">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                {t('newsletterSuccess')}
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mx-auto mt-8 max-w-md">
                <label htmlFor="newsletter-email" className="sr-only">{t('newsletterPlaceholder')}</label>
                <div
                  className={cn(
                    'flex items-center rounded-full border-[1.5px] bg-white/95 p-1.5 pe-2 shadow-lg backdrop-blur transition-all focus-within:border-sun-300 focus-within:ring-4 focus-within:ring-sun-300/25',
                    state === 'err' ? 'border-red-300' : 'border-white/30',
                  )}
                >
                  <input
                    id="newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); if (state === 'err') setState('idle') }}
                    placeholder={t('newsletterPlaceholder')}
                    required
                    autoComplete="email"
                    aria-invalid={state === 'err'}
                    aria-describedby={state === 'err' ? 'newsletter-error' : undefined}
                    dir="ltr"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-2 text-sm text-sea-900 placeholder:text-sea-900/40 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={state === 'loading'}
                    className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-sun-500 to-sun-400 px-5 text-sm font-semibold text-white transition-all hover:from-sun-600 hover:to-sun-500 disabled:opacity-70"
                  >
                    {state === 'loading' ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /><span className="sr-only">{common('loading')}</span></>
                    ) : (
                      <>
                        {t('newsletterCta')}
                        <ArrowRight className="h-4 w-4 rtl:-scale-x-100" />
                      </>
                    )}
                  </button>
                </div>
                <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
                <Turnstile onToken={setTurnstileToken} />
                {errMsg && (
                  <p id="newsletter-error" role="alert" className="mt-3 text-xs text-red-200">{errMsg}</p>
                )}
              </form>
            )}
          </Reveal>
        </div>
      </div>
    </section>
  )
}
