import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { getSiteSettings, getTransferPricing } from '@/lib/data'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { TransferBookingClient } from '@/components/TransferBookingClient'
import { SectionHeading, WaveDivider } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'
import { Truck, Clock3, Wallet } from 'lucide-react'

export const revalidate = 60

export const metadata = {
  title: 'Transfers',
}

export default async function TransfersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const ar = locale === 'ar'
  const t = await getTranslations('transfer')
  const [pricing, settings] = await Promise.all([getTransferPricing(), getSiteSettings()])

  const why = [
    { icon: Truck, title: t('why1'), desc: t('why1Desc') },
    { icon: Clock3, title: t('why2'), desc: t('why2Desc') },
    { icon: Wallet, title: t('why3'), desc: t('why3Desc') },
  ]

  return (
    <div className="bg-sand-50">
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-24 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src={PLACEHOLDER_IMAGES.dahab3} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {t('eyebrow')}
          </span>
          <h1 className="font-display text-4xl font-extrabold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <TransferBookingClient pricing={pricing} whatsapp={settings?.whatsapp_number} />
        </div>
      </section>

      <section className="section-padding bg-sand-100">
        <div className="container-main">
          <SectionHeading title={t('whyTitle')} align="center" />
          <div className="grid gap-5 sm:grid-cols-3">
            {why.map((item, i) => (
              <Reveal key={i} delay={i * 80} className="h-full">
                <div className="h-full border-[1.5px] border-sand-300 bg-white p-6 text-center pin-card">
                  <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-sea-50 text-sea-600">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-display text-base font-bold text-sea-900">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-sea-900/60">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
