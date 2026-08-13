import { getTranslations } from 'next-intl/server'
import { getCommunityPosts } from '@/lib/data'
import { CommunityClient } from '@/components/CommunityClient'

export const revalidate = 60

export default async function CommunityPage() {
  const t = await getTranslations('community')
  const posts = await getCommunityPosts()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white py-20 md:py-24 text-center">
        <div className="container-main">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
          <p className="text-lg text-blue-100 max-w-2xl mx-auto">{t('subtitle')}</p>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-main max-w-3xl">
          <CommunityClient posts={posts} />
        </div>
      </section>
    </div>
  )
}
