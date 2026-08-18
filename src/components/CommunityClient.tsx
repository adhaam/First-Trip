'use client'

import { useMemo, useState } from 'react'
import { useLocale } from 'next-intl'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { Pin, Calendar, BookOpen, Compass, Waves, Mountain, Landmark } from 'lucide-react'
import type { CommunityPost, PostCategory } from '@/lib/types'

const icons: Partial<Record<PostCategory, typeof BookOpen>> = {
  diving: Waves,
  freediving: Waves,
  watersports: Waves,
  climbing: Mountain,
  hiking: Mountain,
  'advanced-adventure': Mountain,
  history: Landmark,
  culture: Landmark,
}

export function CommunityClient({ posts }: { posts: CommunityPost[] }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<PostCategory | 'all'>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const categories = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))),
    [posts],
  )
  const sorted = useMemo(() => posts
    .filter((post) => filter === 'all' || post.category === filter)
    .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || a.sort_order - b.sort_order || b.created_at.localeCompare(a.created_at)),
  [posts, filter])

  return (
    <>
      <div className="no-scrollbar mb-10 flex gap-2 overflow-x-auto pb-2">
        {(['all', ...categories] as const).map((category) => (
          <button
            key={category}
            onClick={() => setFilter(category)}
            className={cn(
              'shrink-0 rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
              filter === category
                ? 'border-sun-500 bg-sun-500 text-white'
                : 'border-sand-300 bg-sand-50 text-sea-900/70 hover:border-sun-400 hover:text-sea-900',
            )}
          >
            {category === 'all' ? (ar ? 'الكل' : 'All stories') : POST_CATEGORY_LABELS[category][ar ? 'ar' : 'en']}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        {sorted.map((post, index) => {
          const Icon = icons[post.category] || Compass
          const expanded = expandedId === post.id
          const featured = index === 0 && filter === 'all'
          const content = ar ? post.content_ar : post.content_en
          const wordCount = content.trim().split(/\s+/).filter(Boolean).length
          const readingMinutes = Math.max(1, Math.ceil(wordCount / 200))
          return (
            <Reveal key={post.id} delay={(index % 6) * 50} className={featured ? 'md:col-span-2 lg:col-span-8' : 'lg:col-span-4'}>
              <article className={cn('group h-full overflow-hidden border bg-[#fffdf8]', post.is_pinned ? 'border-sun-400' : 'border-sand-300')}>
                {post.image_url && (
                  <div className={cn('overflow-hidden bg-sand-200', featured ? 'aspect-[16/8]' : 'aspect-[4/3]')}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- CMS URLs are not limited to one image host. */}
                    <img src={post.image_url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" />
                  </div>
                )}
                <div className={cn('p-6', featured && 'md:p-8')}>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-sea-900/50">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-sun-600">
                      <Icon className="h-3.5 w-3.5" />
                      {POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']}
                    </span>
                    {post.is_pinned && <span className="inline-flex items-center gap-1"><Pin className="h-3 w-3" />{ar ? 'مثبت' : 'Featured'}</span>}
                    <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(post.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</span>
                    <span>{readingMinutes} {ar ? 'د قراءة' : 'min read'}</span>
                  </div>
                  <h2 className={cn('mt-4 font-display font-bold leading-tight text-sea-900', featured ? 'text-3xl md:text-4xl' : 'text-2xl')}>
                    {ar ? post.title_ar : post.title_en}
                  </h2>
                  <p className={cn('mt-4 whitespace-pre-line leading-relaxed text-sea-900/68', !expanded && 'line-clamp-4')}>
                    {content}
                  </p>
                  {expanded && post.video_url && <video src={post.video_url} controls preload="metadata" className="mt-5 aspect-video w-full bg-black" />}
                  {(wordCount > 45 || post.video_url) && (
                    <button onClick={() => setExpandedId(expanded ? null : post.id)} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-sun-600 hover:text-sun-500">
                      <BookOpen className="h-4 w-4" />
                      {expanded ? (ar ? 'عرض أقل' : 'Show less') : (ar ? 'اقرأ القصة' : 'Read story')}
                    </button>
                  )}
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>

      {sorted.length === 0 && <div className="border border-sand-300 py-16 text-center text-sea-900/50">{ar ? 'لا يوجد محتوى في هذه الفئة بعد' : 'No published stories in this category yet.'}</div>}
    </>
  )
}
