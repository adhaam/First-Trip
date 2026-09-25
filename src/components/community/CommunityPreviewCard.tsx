'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Pin } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { estimateReadingMinutes } from '@/lib/community-view'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { COMMUNITY_CATEGORY_ICONS } from './category-icons'
import type { CommunityPost } from '@/lib/types'

/**
 * The one legitimate use of a click-to-preview card instead of a real link:
 * a post that (should never happen post-backfill, but is handled rather
 * than crashing) has no `slug`, so there is no `/community/<slug>` URL to
 * send a reader to. Visually mirrors `<CommunityCard>` / `<EditorialCard>`
 * so it doesn't read as a broken or second-class card — it opens
 * `<CommunityPreviewModal>` instead of navigating.
 */
export function CommunityPreviewCard({
  post,
  onOpen,
  className,
}: {
  post: CommunityPost
  onOpen: () => void
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
    <GlowCard className={className}>
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${t('readFullStory')}: ${title}`}
        className="group block h-full w-full rounded-[inherit] text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3"
      >
        <article className="hover-lift h-full overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
          <div className="slow-zoom relative aspect-[3/2]">
            <Image src={post.image_url || '/media/heroposter.webp'} alt="" fill sizes="(max-width: 640px) 90vw, 33vw" className="object-cover" />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/15 to-transparent" />
            {post.is_pinned && (
              <span className="absolute start-3 top-3 inline-flex items-center gap-1 rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
                <Pin className="h-3 w-3" aria-hidden />
                {t('pinnedBadge')}
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="eyebrow mb-1.5 text-sun-300">
                <Icon className="h-3 w-3" aria-hidden />
                {categoryLabel}
              </p>
              <h3 className="font-display text-lg font-bold leading-snug text-white drop-shadow">{title}</h3>
              <p className="mt-2 text-xs text-white/85">{t('readingMinutes', { minutes })}</p>
            </div>
          </div>
        </article>
      </button>
    </GlowCard>
  )
}
