import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getCommunityPosts } from '@/lib/data'
import { CommunityClient } from '@/components/CommunityClient'
import { Eyebrow, PageHero, Section } from '@/components/brand'
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
      <PageHero
        image={heroImage}
        tone="night"
        size="md"
        align="center"
        eyebrow={<Eyebrow tone="light" className="justify-center">{t('eyebrow')}</Eyebrow>}
        title={t('title')}
        lede={t('subtitle')}
      />

      <Section tone="paper" size="lg">
        <CommunityClient posts={posts} />
      </Section>
    </div>
  )
}
