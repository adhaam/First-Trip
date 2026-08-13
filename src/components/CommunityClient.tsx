'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { Pin, Calendar, BookOpen, Sparkles, BookHeart, Map, type LucideIcon } from 'lucide-react'
import type { CommunityPost } from '@/lib/types'

const categoryIcons: Record<string, LucideIcon> = {
  blog: BookOpen,
  'hidden-gems': Sparkles,
  stories: BookHeart,
  'dahab-guide': Map,
}

export function CommunityClient({ posts }: { posts: CommunityPost[] }) {
  const t = useTranslations('community')
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = [
    { id: 'all', key: 'all' as const, icon: BookOpen },
    { id: 'blog', key: 'blog', icon: BookOpen },
    { id: 'hidden-gems', key: 'hiddenGems', icon: Sparkles },
    { id: 'stories', key: 'stories', icon: BookHeart },
    { id: 'dahab-guide', key: 'dahabGuide', icon: Map },
  ]

  const filtered = filter === 'all' ? posts : posts.filter((p) => p.category === filter)

  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <>
      {/* Filter tabs */}
      <div className="no-scrollbar mb-8 flex gap-2 overflow-x-auto pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon
          return (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                filter === cat.id
                  ? 'bg-sea-900 text-sand-50'
                  : 'border border-sand-300 bg-white text-sea-900/60 hover:text-sea-900',
              )}
            >
              <Icon className="h-4 w-4" />
              {cat.key === 'all' ? (ar ? 'الكل' : 'All') : t(`categories.${cat.key}` as 'blog')}
            </button>
          )
        })}
      </div>

      {/* Feed */}
      <div className="space-y-5">
        {sorted.map((post, i) => {
          const Icon = categoryIcons[post.category]
          const isExpanded = expandedId === post.id
          return (
            <Reveal key={post.id} delay={(i % 8) * 60}>
              <article
                className={cn(
                  'overflow-hidden border-[1.5px] bg-white pin-card transition-shadow hover:shadow-sm',
                  post.is_pinned ? 'border-sun-300' : 'border-sand-300',
                )}
              >
                {post.image_url && (
                  <div className="relative h-56 w-full overflow-hidden bg-sand-200">
                    {/* eslint-disable-next-line @next/next/no-img-element -- remote URLs, avoids Next/Image domain config churn for admin-entered links */}
                    <img src={post.image_url} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-6">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {post.is_pinned && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sun-400 px-2.5 py-1 text-[0.7rem] font-semibold text-white">
                        <Pin className="h-3 w-3" />
                        {t('pinned')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-full border border-sea-600/25 px-2.5 py-1 text-[0.7rem] font-semibold text-sea-600">
                      <Icon className="h-3 w-3" />
                      {t(
                        `categories.${
                          post.category === 'dahab-guide'
                            ? 'dahabGuide'
                            : post.category === 'hidden-gems'
                              ? 'hiddenGems'
                              : (post.category as 'blog' | 'stories')
                        }`,
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-sea-900/40">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-US')}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold text-sea-900">
                    {ar ? post.title_ar : post.title_en}
                  </h3>
                  <p
                    className={cn(
                      'mt-2 leading-relaxed text-sea-900/65',
                      !isExpanded && 'line-clamp-4',
                    )}
                  >
                    {ar ? post.content_ar : post.content_en}
                  </p>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : post.id)}
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-sea-600 transition-colors hover:text-sun-500"
                  >
                    {isExpanded
                      ? (ar ? 'عرض أقل ↑' : 'Show less ↑')
                      : `${t('readMore')} →`}
                  </button>
                </div>
              </article>
            </Reveal>
          )
        })}

        {sorted.length === 0 && (
          <div className="py-16 text-center text-sea-900/40">
            {ar ? 'لا يوجد محتوى في هذه الفئة بعد' : 'No content in this category yet'}
          </div>
        )}
      </div>
    </>
  )
}
