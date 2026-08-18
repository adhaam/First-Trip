'use client'

import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { KeyRound, MessageCircle } from 'lucide-react'

export function RentClient({ whatsapp }: { whatsapp?: string | null }) {
  const t = useTranslations('future')
  const number = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  return (
    <div className="bg-sand-50">
      <section className="relative isolate flex min-h-[70svh] items-end overflow-hidden bg-sea-900 py-16 text-white md:items-center md:py-24">
        <Image src="/media/heroposter.png" alt="" fill sizes="100vw" className="-z-20 object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/65 to-black/25 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <KeyRound className="mb-6 h-9 w-9 text-sun-300" />
          <p className="eyebrow text-sun-300">WEEMAP</p>
          <h1 className="mt-4 max-w-3xl text-5xl font-extrabold leading-none sm:text-6xl md:text-7xl">{t('rentTitle')}</h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/75">{t('rentText')}</p>
          <a href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-sun-500 px-6 font-semibold text-white hover:bg-sun-600"><MessageCircle className="h-4 w-4" />{t('contact')}</a>
        </div>
      </section>
    </div>
  )
}
