import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { NEUTRAL_MEDIA } from '@/lib/media'

export interface LocalGuidePost {
  id: string
  slug: string | null
  title_ar: string
  title_en: string
  image_url: string | null
}

/**
 * "Local guides" — published community posts that an operator explicitly
 * linked to THIS stay/trip/package/experience (community_post_links,
 * migration 037). Nothing here is inferred from category or keyword match.
 */
export function LocalGuides({
  posts,
  locale,
  heading,
}: {
  posts: LocalGuidePost[]
  locale: string
  heading: string
}) {
  const withSlug = posts.filter((p): p is LocalGuidePost & { slug: string } => Boolean(p.slug))
  if (withSlug.length === 0) return null
  const ar = locale === 'ar'

  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold text-sea-900">{heading}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {withSlug.map((post) => {
          const title = ar ? post.title_ar || post.title_en : post.title_en || post.title_ar
          return (
            <Link
              key={post.id}
              href={`/community/${post.slug}`}
              className="group flex items-center gap-3 rounded-2xl border-[1.5px] border-sand-300 bg-card p-3 transition-colors hover:border-sun-500"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                <Image src={post.image_url || NEUTRAL_MEDIA} alt={title} fill sizes="56px" className="object-cover" />
              </div>
              <span className="flex min-w-0 flex-1 items-center justify-between gap-2 text-sm font-semibold text-sea-900">
                <span className="truncate">{title}</span>
                <ArrowForward className="h-3.5 w-3.5 shrink-0 text-sun-600 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
