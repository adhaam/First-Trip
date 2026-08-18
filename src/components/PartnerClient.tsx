'use client'

import { useLocale } from 'next-intl'
import Image from 'next/image'
import { WHATSAPP_NUMBER, EMAIL } from '@/lib/constants'
import { Handshake, Building2, Compass, Bus, MessageCircle, Mail } from 'lucide-react'
import type { SiteSettings } from '@/lib/types'

export function PartnerClient({ settings }: { settings: SiteSettings | null }) {
  const ar = useLocale() === 'ar'
  const whatsapp = (settings?.whatsapp_number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const email = settings?.email || EMAIL
  const groups = [
    { icon: Building2, ar: 'أماكن إقامة', en: 'Stays' },
    { icon: Compass, ar: 'تجارب ورحلات', en: 'Experiences' },
    { icon: Bus, ar: 'خدمات نقل', en: 'Transport' },
  ]
  return (
    <div className="bg-sand-50">
      <section className="relative isolate min-h-[64svh] overflow-hidden bg-sea-900 py-20 text-white md:py-28">
        <Image src="/media/heroposter.png" alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/20 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <Handshake className="h-10 w-10 text-sun-300" />
          <p className="eyebrow mt-6 text-sun-300">{ar ? 'اشتغل مع وي ماب' : 'Partner with WEEMAP'}</p>
          <h1 className="mt-4 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl md:text-7xl">{ar ? 'خلّي تجربتك جزء من خريطة سينا.' : 'Bring your Sinai experience onto the map.'}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/75">{ar ? 'بنرحب بالتواصل مع مقدمي الخدمات الحقيقيين في سينا. كل تعاون بيتراجع ويتفق عليه بشكل مباشر.' : 'We welcome conversations with real Sinai operators. Every collaboration is reviewed and agreed directly.'}</p>
        </div>
      </section>
      <main className="container-main py-14 md:py-20">
        <div className="grid gap-5 md:grid-cols-3">
          {groups.map(({ icon: Icon, ar: labelAr, en }) => <div key={en} className="border-t-2 border-sun-500 bg-[#fffdf8] p-7"><Icon className="h-6 w-6 text-sun-500" /><h2 className="mt-5 text-xl font-bold">{ar ? labelAr : en}</h2></div>)}
        </div>
        <section className="mt-12 grid gap-8 bg-[#1b1b17] p-8 text-white md:grid-cols-[1fr_auto] md:items-center md:p-12">
          <div><h2 className="text-3xl font-bold">{ar ? 'عرّفنا بتجربتك.' : 'Tell us about what you do.'}</h2><p className="mt-3 text-white/65">{ar ? 'تواصل من خلال بيانات وي ماب الرسمية.' : 'Reach us through WEEMAP’s official contact channels.'}</p></div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener" className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-sun-500 px-6 font-semibold hover:bg-sun-600"><MessageCircle className="h-4 w-4" />WhatsApp</a>
            <a href={`mailto:${email}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-white/30 px-6 font-semibold hover:bg-white/10"><Mail className="h-4 w-4" />Email</a>
          </div>
        </section>
      </main>
    </div>
  )
}
