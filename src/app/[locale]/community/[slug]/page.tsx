import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { getCommunityPostBySlug, getRelatedCommunityPosts } from '@/lib/data'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getArticleSchema } from '@/lib/schema-org'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { Calendar, Pin, ArrowLeft, ArrowRight } from 'lucide-react'

export const revalidate = 60

export async function generateMetadata({ params }: {
  params: Promise<{ slug: string; locale: string }>
}): Promise<Metadata> {
  const { slug, locale } = await params
  const post = await getCommunityPostBySlug(slug).catch(() => null)
  const alternates = buildAlternates(`/community/${slug}`, locale)
  if (!post) return { alternates }

  const ar = locale === 'ar'
  const title = ar ? post.title_ar || post.title_en : post.title_en || post.title_ar
  const content = ar ? post.content_ar : post.content_en
  const description = content?.slice(0, 160)
  const image = post.image_url || `${SITE_URL}/brand/logo.png`

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      images: [{ url: image }],
      type: 'article',
      publishedTime: post.created_at,
    },
  }
}

export default async function CommunityPostPage({ params }: {
  params: Promise<{ slug: string; locale: string }>
}) {
  const { slug, locale } = await params
  const post = await getCommunityPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const ar = locale === 'ar'
  const title = ar ? post.title_ar : post.title_en
  const content = ar ? post.content_ar : post.content_en
  const related = await getRelatedCommunityPosts(post, 3)
  const BackIcon = ar ? ArrowRight : ArrowLeft

  const articleSchema = getArticleSchema({
    title,
    description: content?.slice(0, 160) || '',
    image: post.image_url || `${SITE_URL}/brand/logo.png`,
    datePublished: post.created_at,
    url: `${SITE_URL}${ar ? '' : '/en'}/community/${slug}`,
    inLanguage: ar ? 'ar' : 'en',
  })

  return (
    <div className="bg-sand-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema).replace(/</g, '\\u003c') }}
      />

      <article className="section-padding" dir={ar ? 'rtl' : 'ltr'}>
        <div className="container-main max-w-3xl">
          {/* Back to community */}
          <Link
            href="/community"
            className="inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-sun-700 transition-colors"
          >
            <BackIcon className="h-4 w-4" />
            {ar ? 'العودة للكوميونيتي' : 'Back to Community'}
          </Link>

          {/* Meta */}
          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
            <Link
              href="/community"
              className="inline-flex items-center gap-1.5 font-semibold text-sun-700 hover:text-sun-700"
            >
              {POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']}
            </Link>
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1">
                <Pin className="h-3 w-3" />
                {ar ? 'مثبت' : 'Pinned'}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}
            </span>
          </div>

          {/* Title */}
          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-sea-900 md:text-5xl">
            {title}
          </h1>

          {/* Hero image */}
          {post.image_url && (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden rounded-xl bg-sand-200">
              <Image
                src={post.image_url}
                alt={title}
                fill
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
                priority
              />
            </div>
          )}

          {/* Body */}
          <div className="mt-8 whitespace-pre-line text-lg leading-relaxed text-ink-muted">
            {content}
          </div>

          {/* Video */}
          {post.video_url && (
            <video
              src={post.video_url}
              controls
              preload="metadata"
              className="mt-8 aspect-video w-full rounded-lg bg-black"
            />
          )}
        </div>
      </article>

      {/* Related articles */}
      {related.length > 0 && (
        <section className="border-t border-sand-300 bg-[#fffdf8] section-padding" dir={ar ? 'rtl' : 'ltr'}>
          <div className="container-main max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-sea-900">
              {ar ? 'مقالات ذات صلة' : 'Related articles'}
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={r.slug ? `/community/${r.slug}` : '/community'}
                  className="group block overflow-hidden rounded-lg border border-sand-300 bg-white transition-shadow hover:shadow-md"
                >
                  {r.image_url && (
                    <div className="aspect-[4/3] w-full overflow-hidden bg-sand-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.image_url}
                        alt={ar ? r.title_ar : r.title_en}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <span className="text-xs font-semibold text-sun-700">
                      {POST_CATEGORY_LABELS[r.category][ar ? 'ar' : 'en']}
                    </span>
                    <h3 className="mt-2 font-display font-bold leading-tight text-sea-900">
                      {ar ? r.title_ar : r.title_en}
                    </h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
