'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Rail } from '@/components/brand/Rail'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { Link } from '@/i18n/navigation'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import type { CommunityPost } from '@/lib/types'
import { NEUTRAL_MEDIA } from '@/lib/media'

const RAIL_LIMIT = 6

/**
 * "Local guides" — a teaser into real WEEMAP community posts, never a
 * generic "related content" block. Only rendered when published posts with
 * a public URL actually exist (see the caller in book-dahab/[id]/page.tsx),
 * and never labelled "related" — these posts have no relationship to this
 * specific stay, they are local knowledge in general.
 */
export function StayLocalGuides({ posts }: { posts: CommunityPost[] }) {
  const t = useTranslations('stays')
  const locale = useLocale()
  const ar = locale === 'ar'

  const linkable = posts.filter((post) => post.slug)
  if (linkable.length === 0) return null

  return (
    <div>
      <Rail label={t('detail.guidesHint')}>
        {linkable.slice(0, RAIL_LIMIT).map((post) => (
          <div key={post.id} className="rail-snap-item w-[78vw] shrink-0 sm:w-72">
            <EditorialCard
              href={`/community/${post.slug}`}
              image={post.image_url || NEUTRAL_MEDIA}
              title={ar ? post.title_ar : post.title_en}
              size="sm"
            />
          </div>
        ))}
      </Rail>
      <Link
        href="/community"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-sea-600 transition-colors hover:text-sun-700"
      >
        {t('detail.guidesCta')}
        <ArrowForward className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}
