import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import Image from 'next/image'
import { getCommunityPosts } from '@/lib/data'
import { CommunityClient } from '@/components/CommunityClient'
import { WaveDivider } from '@/components/brand/Section'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'community' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/community', locale),
  }
}

export default async function CommunityPage() {
  const t = await getTranslations('community')
  const posts = await getCommunityPosts()

  return (
    <div className="bg-sand-50">
      <section className="relative overflow-hidden bg-sea-900 py-20 text-center text-white md:py-24 grain">
        <div className="absolute inset-0 opacity-20">
          <Image src="/media/heroposter.webp" alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-sea-900/60 to-sea-900" />
        </div>
        <div className="container-main relative z-10">
          <span className="eyebrow mb-5 justify-center text-sun-300">
            <span aria-hidden className="h-px w-6 bg-current" />
            {t('title')}
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">{t('title')}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-sand-100/80">{t('subtitle')}</p>
        </div>
        <WaveDivider className="absolute inset-x-0 bottom-0 text-sand-50" />
      </section>

      <section className="section-padding bg-sand-50">
        <div className="container-main">
          <CommunityClient posts={posts} />
        </div>
      </section>
    </div>
  )
}
