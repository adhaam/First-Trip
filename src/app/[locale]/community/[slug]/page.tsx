import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Calendar, Pin } from 'lucide-react'
import { getCommunityPostBySlug, getRelatedCommunityPosts, getSinaiTrips } from '@/lib/data'
import { buildAlternates, SITE_URL } from '@/lib/seo'
import { getArticleSchema } from '@/lib/schema-org'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { activeTripCategorySlugs, estimateReadingMinutes, matchingTripCategorySlug } from '@/lib/community-view'
import { formatCount, formatDate } from '@/lib/format'
import { ArrowBack, ArrowForward, ChevronForward } from '@/components/brand/DirectionalIcon'
import { CommunityCard } from '@/components/community/CommunityCard'
import { COMMUNITY_CATEGORY_ICONS } from '@/components/community/category-icons'

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
  if (!post) notFound()

  const ar = locale === 'ar'
  const t = await getTranslations({ locale, namespace: 'communityV2' })
  const [related, trips] = await Promise.all([getRelatedCommunityPosts(post, 3), getSinaiTrips()])

  const title = ar ? post.title_ar : post.title_en
  const content = ar ? post.content_ar : post.content_en
  const categoryLabel = POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']
  const CategoryIcon = COMMUNITY_CATEGORY_ICONS[post.category]
  const minutes = estimateReadingMinutes(content)
  const relatedWithSlug = related.filter((r): r is typeof r & { slug: string } => Boolean(r.slug))

  // "Explore <category> trips" is offered ONLY when the post's category slug
  // is byte-identical to a real, active structured Sinai Trip category —
  // never inferred (see BRIEF.md "Never invent... relationships").
  const tripSlugs = activeTripCategorySlugs(trips)
  const matchedSlug = matchingTripCategorySlug(post, tripSlugs)
  const matchedTripCategoryName = matchedSlug
    ? trips.flatMap((trip) => trip.category_tags ?? []).find((tag) => tag.slug === matchedSlug)
    : null
  const matchedCategoryLabel = matchedTripCategoryName ? (ar ? matchedTripCategoryName.name_ar : matchedTripCategoryName.name_en) : null

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

      <article>
        {/* Breadcrumb */}
        <div className="container-main pt-8">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
            <Link href="/community" className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink-muted hover:text-sun-700">
              <ArrowBack className="h-4 w-4" />
              {t('backToCommunity')}
            </Link>
            <ChevronForward className="h-3.5 w-3.5 text-ink-subtle" />
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold text-sun-700 ${ar ? '' : 'uppercase tracking-wide'}`}>
              <CategoryIcon className="h-3.5 w-3.5" aria-hidden />
              {categoryLabel}
            </span>
          </nav>
        </div>

        <div className="container-main mt-4 max-w-3xl">
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1 font-semibold text-sun-700">
                <Pin className="h-3 w-3" aria-hidden />
                {t('pinnedBadge')}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden />
              {t('publishedOn', { date: formatDate(post.created_at, locale) })}
            </span>
            <span>{t('readingMinutes', { minutes, minutesText: formatCount(minutes, locale) })}</span>
          </div>

          <h1 className="mt-4 font-display text-3xl font-bold leading-tight text-sea-900 md:text-5xl">{title}</h1>

          {post.image_url && (
            <div className="relative mt-8 aspect-[16/9] w-full overflow-hidden pin-card bg-sand-200">
              <Image src={post.image_url} alt={title} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
            </div>
          )}

          {/* Long-read body — measure capped for readability, Arabic gets a
              larger size and taller line-height per BRIEF.md typography rules. */}
          <div
            className={
              ar
                ? 'mx-auto mt-10 max-w-[65ch] whitespace-pre-line text-[1.15rem] leading-[2.1] text-ink'
                : 'mx-auto mt-10 max-w-[70ch] whitespace-pre-line text-lg leading-8 text-ink'
            }
          >
            {content}
          </div>

          {post.video_url && (
            <video src={post.video_url} controls preload="metadata" className="mx-auto mt-8 aspect-video w-full max-w-[70ch] rounded-lg bg-black" />
          )}
        </div>

        {/* Plan it with WEEMAP */}
        <div className="container-main mt-14 max-w-3xl">
          <div className="rounded-3xl border-[1.5px] border-sand-300 bg-card p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold text-sea-900">{t('planTitle')}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-muted">{t('planBody')}</p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/plan"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sun-500 px-5 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600"
              >
                {t('planBuildCta')}
                <ArrowForward className="h-4 w-4" />
              </Link>
              <Link
                href="/sinai-trips"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] border-sea-900 px-5 text-sm font-semibold text-sea-900 transition-colors hover:bg-sea-900 hover:text-sand-50"
              >
                {matchedCategoryLabel ? t('exploreCategoryTrips', { category: matchedCategoryLabel }) : t('planTripsCta')}
                <ArrowForward className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </article>

      {/* Related articles */}
      {relatedWithSlug.length > 0 && (
        <section className="border-t border-sand-300 bg-[#fffdf8] section-padding">
          <div className="container-main max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-sea-900">{t('relatedTitle')}</h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-3">
              {relatedWithSlug.map((r) => (
                <CommunityCard key={r.id} post={r} size="sm" />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
