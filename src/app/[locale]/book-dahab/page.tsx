import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { PLACEHOLDER_IMAGES } from '@/lib/constants'
import { Calendar, ArrowUpRight } from 'lucide-react'
import Image from 'next/image'
import { getAccommodations } from '@/lib/data'
import { BookDahabClient } from '@/components/BookDahabClient'
import { SectionHeading, WaveDivider } from '@/components/brand/Section'
import { Reveal } from '@/components/motion/Reveal'

export const revalidate = 60

export default async function BookDahabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const ar = locale === 'ar'
  const t = await getTranslations('book')
  const accommodations = await getAccommodations()

  return (
    <div className="bg-sand-50">
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-28 grain">
        <div className="absolute inset-0 opacity-25">
          <Image src={PLACEHOLDER_IMAGES.dahab1} alt="" fill className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {ar ? 'احجز دهب' : 'Book Dahab'}
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      {/* ─── About + Schedule ─── */}
      <section className="section-padding bg-sand-50">
        <div className="container-main grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <SectionHeading eyebrow={ar ? 'عن الرحلة' : 'The trip'} title={t('aboutTrip')} className="mb-6" />
            <p className="leading-relaxed text-sea-900/65">
              {ar
                ? 'رحلات WEEMAP لدهب تجربة سياحية متكاملة — انتقالات مريحة من محافظتك، إقامة في أفضل الفنادق والشاليهات والكمبات، ورحلتين داخليتين ضمن الباقة. مناسبة للأفراد والعائلات والمجموعات.'
                : 'WEEMAP Dahab packages are a complete experience — comfortable transportation from your city, accommodation in the best hotels, chalets and camps, plus two day trips included. Great for individuals, families and groups.'}
            </p>
            <div className="mt-6 flex items-center gap-2 text-sun-500">
              <Calendar className="h-5 w-5" />
              <span className="font-semibold text-sea-900">{t('schedule')}</span>
            </div>
            <p className="mt-1 text-sm text-sea-900/50">{t('scheduleText')}</p>
          </Reveal>

          <Reveal delay={100}>
            <div className="border-[1.5px] border-sand-300 bg-card p-7 pin-card">
              <h3 className="font-display text-lg font-bold text-sea-900">
                {ar ? 'تواريخ الرحلات المتاحة' : 'Available trip dates'}
              </h3>
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl border border-sand-300 bg-sand-50 p-4">
                  <div>
                    <div className="font-semibold text-sea-900">
                      {ar ? 'كل يوم خميس' : 'Every Thursday'}
                    </div>
                    <div className="text-sm text-sea-900/50">{t('day4')}</div>
                  </div>
                  <span className="rounded-full bg-sea-900 px-3 py-1 text-xs font-semibold text-white">
                    4
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-sun-300 bg-sun-50 p-4">
                  <div>
                    <div className="font-semibold text-sea-900">
                      {ar ? 'كل يوم أحد' : 'Every Sunday'}
                    </div>
                    <div className="text-sm text-sea-900/50">{t('day5')}</div>
                  </div>
                  <span className="rounded-full bg-sun-400 px-3 py-1 text-xs font-semibold text-white">
                    5
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 p-4">
                  <div>
                    <div className="font-semibold text-sea-900">
                      {ar ? 'كل يوم بالهايس' : 'Every day with Hiace'}
                    </div>
                    <div className="text-sm text-sea-900/50">
                      {ar ? 'هايس خاص — أي يوم على مزاجك' : 'Private Hiace — any day you want'}
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-white">
                    {ar ? 'يومي' : 'Daily'}
                  </span>
                </div>
              </div>
              <p className="mt-4 text-center text-xs text-sea-900/40">
                {ar ? 'الباص كل أحد وخميس · الهايس كل يوم' : 'Bus every Sun & Thu · Hiace every day'}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─── Accommodations ─── */}
      <section className="section-padding bg-sand-100">
        <div className="container-main">
          <SectionHeading title={t('accommodations')} />
          <BookDahabClient accommodations={accommodations} />
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative overflow-hidden bg-sun-400 py-16 text-center text-white">
        <div className="container-main relative">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            {ar ? 'مش لاقي المكان المناسب؟' : 'Can\'t find the right place?'}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-white/85">
            {ar ? 'كلمنا على واتساب ونرشحلك على مزاجك' : 'Message us on WhatsApp and we\'ll recommend something for you'}
          </p>
          <a
            href="https://wa.me/201005744083"
            target="_blank"
            rel="noopener"
            className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-sea-900 px-7 text-sm font-semibold text-white transition-colors hover:bg-sea-700"
          >
            {ar ? 'كلمنا على واتساب' : 'Message us on WhatsApp'}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" />
          </a>
        </div>
      </section>
    </div>
  )
}
