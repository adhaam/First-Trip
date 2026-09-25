import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { SafeImage as Image } from '@/components/SafeImage'
import { getCommunityPosts } from '@/lib/data'
import { CommunityClient } from '@/components/CommunityClient'
import { Eyebrow, Section } from '@/components/brand'
import { Reveal } from '@/components/motion/Reveal'
import { buildAlternates } from '@/lib/seo'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'communityV2' })
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: buildAlternates('/community', locale),
  }
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'communityV2' })
  const posts = await getCommunityPosts()
  const heroImage = posts.find((p) => p.image_url)?.image_url || undefined

  return (
    <div className="bg-sand-50">
      {/*
        Hand-rolled instead of the shared <PageHero> primitive — same
        contrast fix as /signature: PageHero's default scrim is too weak
        against a bright photo for centered text, which sits over the
        photo's brightest, least-controlled area. See the comment on
        /signature/page.tsx for the full rationale.
      */}
      <section className="relative isolate flex min-h-[52vh] items-center overflow-hidden bg-sea-900 text-center text-sand-50 sm:min-h-[58vh]">
        {heroImage && (
          <Image src={heroImage} alt="" fill priority sizes="100vw" className="absolute inset-0 object-cover" />
        )}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-sea-900/90 via-sea-900/85 via-50% to-sea-900/55"
        />
        <div aria-hidden className="topo-bg absolute inset-0 opacity-25 mix-blend-overlay" />

        <div className="container-main relative py-12 sm:py-16 md:py-20">
          <Reveal always className="mx-auto max-w-2xl">
            <Eyebrow tone="light" className="justify-center">{t('eyebrow')}</Eyebrow>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-tight text-white drop-shadow-sm sm:text-5xl md:text-6xl">
              {t('title')}
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-white/90 sm:text-lg">{t('subtitle')}</p>
          </Reveal>
        </div>
      </section>

      <Section tone="paper" size="lg">
        <CommunityClient posts={posts} />
      </Section>
    </div>
  )
}
