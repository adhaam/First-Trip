'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Pin } from 'lucide-react'
import { EditorialCard } from '@/components/brand/EditorialCard'
import { estimateReadingMinutes } from '@/lib/community-view'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { COMMUNITY_CATEGORY_ICONS } from './category-icons'
import type { CommunityPost } from '@/lib/types'

/**
 * The Community surface's face of the shared `<EditorialCard>`. Real
 * navigation only — a slugged post is a real `/community/<slug>` link (see
 * BRIEF.md primitive contract); a post somehow missing a slug is not
 * rendered by this component at all (the page falls back to
 * `CommunityPreviewCard` for that rare case instead of faking a link).
 */
export function CommunityCard({
  post,
  size = 'md',
  priority = false,
  className,
}: {
  post: CommunityPost & { slug: string }
  size?: 'lg' | 'md' | 'sm'
  priority?: boolean
  className?: string
}) {
  const t = useTranslations('communityV2')
  const locale = useLocale()
  const ar = locale === 'ar'

  const title = ar ? post.title_ar : post.title_en
  const content = ar ? post.content_ar : post.content_en
  const categoryLabel = POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']
  const Icon = COMMUNITY_CATEGORY_ICONS[post.category]
  const minutes = estimateReadingMinutes(content)

  return (
    <EditorialCard
      href={`/community/${post.slug}`}
      image={post.image_url || '/media/heroposter.webp'}
      title={title}
      kicker={
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {categoryLabel}
        </span>
      }
      badge={
        post.is_pinned ? (
          <span className="inline-flex items-center gap-1">
            <Pin className="h-3 w-3" aria-hidden />
            {t('pinnedBadge')}
          </span>
        ) : undefined
      }
      meta={<span>{t('readingMinutes', { minutes })}</span>}
      size={size}
      priority={priority}
      className={className}
    />
  )
}
