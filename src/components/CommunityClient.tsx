'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { Chip, ChipRail } from '@/components/brand/Chip'
import { EmptyState } from '@/components/EmptyState'
import { CommunityCard } from '@/components/community/CommunityCard'
import { CommunityPreviewCard } from '@/components/community/CommunityPreviewCard'
import { CommunityPreviewModal } from '@/components/community/CommunityPreviewModal'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import {
  communityCategoryFacets,
  selectFeaturedPost,
  selectSecondaryPosts,
} from '@/lib/community-view'
import { formatCount } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommunityPost, PostCategory } from '@/lib/types'

/**
 * Editorial Community index: one lead story, a category nav built only from
 * categories that actually have posts, and a grid below. Real navigation
 * only — `<CommunityCard>` is a genuine `/community/<slug>` link; the modal
 * preview (`<CommunityPreviewCard>` / `<CommunityPreviewModal>`) is a
 * fallback for the rare post with no slug, never a substitute for a link a
 * slugged post could have had.
 */
export function CommunityClient({ posts }: { posts: CommunityPost[] }) {
  const locale = useLocale()
  const t = useTranslations('communityV2')
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<PostCategory | 'all'>('all')
  const [previewPost, setPreviewPost] = useState<CommunityPost | null>(null)

  const facets = useMemo(() => communityCategoryFacets(posts), [posts])
  const filtered = useMemo(
    () => (filter === 'all' ? posts : posts.filter((post) => post.category === filter)),
    [posts, filter],
  )
  const featured = useMemo(() => selectFeaturedPost(filtered), [filtered])
  const secondary = useMemo(() => selectSecondaryPosts(filtered), [filtered])

  if (posts.length === 0) {
    return <EmptyState variant="curating" title={t('noPosts')} />
  }

  return (
    <>
      {facets.length > 1 && (
        <ChipRail className="mb-10">
          <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
            {t('categoryAll')}
          </Chip>
          {facets.map(({ category, count }) => {
            const selected = filter === category
            return (
              <Chip key={category} selected={selected} onClick={() => setFilter(category)}>
                {/* Chip's own `count` prop renders the raw JS number (always
                    Latin digits) — this mirrors its badge styling but with a
                    locale-formatted count via formatCount, so Arabic gets
                    Arabic-Indic digits (see src/lib/format.ts). */}
                <span className="inline-flex items-center gap-1.5">
                  {POST_CATEGORY_LABELS[category][ar ? 'ar' : 'en']}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-xs font-bold tabular-nums',
                      selected ? 'bg-white/20' : 'bg-sand-200 text-ink-subtle',
                    )}
                  >
                    {formatCount(count, locale)}
                  </span>
                </span>
              </Chip>
            )
          })}
        </ChipRail>
      )}

      {filtered.length === 0 ? (
        <EmptyState variant="no-results" title={t('noCategoryMatches')} onClear={() => setFilter('all')} />
      ) : (
        <div className="space-y-10">
          {featured && (
            <Reveal>
              {featured.slug ? (
                <CommunityCard post={featured as CommunityPost & { slug: string }} size="lg" priority />
              ) : (
                <CommunityPreviewCard post={featured} onOpen={() => setPreviewPost(featured)} />
              )}
            </Reveal>
          )}

          {secondary.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {secondary.map((post, index) => (
                <Reveal key={post.id} delay={(index % 6) * 50}>
                  {post.slug ? (
                    <CommunityCard post={post as CommunityPost & { slug: string }} />
                  ) : (
                    <CommunityPreviewCard post={post} onOpen={() => setPreviewPost(post)} />
                  )}
                </Reveal>
              ))}
            </div>
          )}
        </div>
      )}

      {previewPost && <CommunityPreviewModal post={previewPost} onClose={() => setPreviewPost(null)} />}
    </>
  )
}
