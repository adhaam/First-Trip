'use client'

import { useLocale } from 'next-intl'
import Image from 'next/image'
import { Shield, RefreshCcw, FileText, Lock } from 'lucide-react'
import type { SiteSettings } from '@/lib/types'

export function PolicyClient({ settings }: { settings: SiteSettings | null }) {
  const ar = useLocale() === 'ar'
  const sections = [
    {
      icon: RefreshCcw,
      title: ar ? 'الإلغاء والاسترداد' : 'Cancellation & refunds',
      text: ar ? settings?.refund_policy_ar : settings?.refund_policy_en,
    },
    {
      icon: FileText,
      title: ar ? 'الشروط والأحكام' : 'Terms & conditions',
      text: ar ? settings?.terms_ar : settings?.terms_en,
    },
    {
      icon: Lock,
      title: ar ? 'الخصوصية' : 'Privacy',
      text: ar ? settings?.privacy_policy_ar : settings?.privacy_policy_en,
    },
  ]
  const fallback = ar
    ? 'سيتم توضيح السياسة المطبقة وتأكيدها معك قبل أي دفع. تواصل مع وي ماب إذا محتاج تفاصيل إضافية.'
    : 'The applicable policy will be explained and confirmed before any payment. Contact WEEMAP if you need more detail.'

  return (
    <div className="bg-sand-50">
      <section className="relative isolate overflow-hidden bg-sea-900 py-20 text-white md:py-28">
        <Image src="/media/heroposter.png" alt="" fill sizes="100vw" className="-z-20 object-cover opacity-35" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 to-black/45 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <Shield className="h-9 w-9 text-sun-300" />
          <p className="eyebrow mt-6 text-sun-300">{ar ? 'معلومات مهمة' : 'Important information'}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl md:text-6xl">{ar ? 'سياسات واضحة قبل ما تحجز.' : 'Clear policies before you book.'}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/75">{ar ? 'المحتوى هنا بييجي مباشرة من إعدادات وي ماب.' : 'These policies are managed directly through WEEMAP settings.'}</p>
        </div>
      </section>
      <main className="container-main py-14 md:py-20">
        <div className="mx-auto max-w-4xl divide-y divide-sand-300 border-y border-sand-300">
          {sections.map(({ icon: Icon, title, text }) => (
            <section key={title} className="grid gap-5 py-9 md:grid-cols-[12rem_1fr] md:py-12">
              <h2 className="flex items-center gap-3 text-lg font-bold text-sea-900"><Icon className="h-5 w-5 text-sun-500" />{title}</h2>
              <p className="whitespace-pre-line text-base leading-8 text-sea-900/72">{text?.trim() || fallback}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  )
}
