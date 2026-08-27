'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Reveal } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { Pin, Calendar, BookOpen, Compass, Waves, Mountain, Landmark, MapPin, Gem, Route, Eye, X } from 'lucide-react'
import type { CommunityPost, PostCategory } from '@/lib/types'

// Covers all 14 PostCategory values — kept exhaustive (not Partial) so a
// newly added category can't silently fall back to the generic Compass icon
// without a deliberate choice being made here.
const icons: Record<PostCategory, typeof BookOpen> = {
  stories: BookOpen,
  'dahab-guide': MapPin,
  'sinai-guide': Compass,
  'hidden-gems': Gem,
  diving: Waves,
  freediving: Waves,
  watersports: Waves,
  climbing: Mountain,
  hiking: Mountain,
  'advanced-adventure': Mountain,
  history: Landmark,
  culture: Landmark,
  itineraries: Route,
  blog: BookOpen,
}

// ─── Post Modal ───────────────────────────────────────────────────────────────
function PostModal({
  post,
  ar,
  onClose,
}: {
  post: CommunityPost
  ar: boolean
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const Icon = icons[post.category] || Compass
  const content = ar ? post.content_ar : post.content_en

  // Focus close button on mount; trap focus inside modal
  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Focus trap
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="presentation"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-modal-title"
        dir={ar ? 'rtl' : 'ltr'}
        className={cn(
          'relative w-full max-w-2xl max-h-[90dvh] overflow-y-auto rounded-xl bg-[#fffdf8] shadow-2xl',
          'flex flex-col',
          // Mobile: full height
          'sm:max-h-[85dvh]',
        )}
        onKeyDown={handleKeyDown}
      >
        {/* Close button */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={ar ? 'إغلاق' : 'Close'}
          className={cn(
            'absolute top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 shadow-md hover:bg-white transition-colors',
            ar ? 'left-3' : 'right-3',
          )}
        >
          <X className="h-4 w-4 text-sea-900" />
        </button>

        {/* Cover image */}
        {post.image_url && (
          <div className="aspect-[16/9] w-full shrink-0 overflow-hidden bg-sand-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.image_url}
              alt={ar ? post.title_ar : post.title_en}
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 p-6 md:p-8">
          {/* Meta */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-sea-900/50 mb-4">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sun-600">
              <Icon className="h-3.5 w-3.5" />
              {POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']}
            </span>
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
          <h2
            id="community-modal-title"
            className="font-display text-2xl md:text-3xl font-bold leading-tight text-sea-900 mb-5"
          >
            {ar ? post.title_ar : post.title_en}
          </h2>

          {/* Content */}
          <p className="whitespace-pre-line leading-relaxed text-sea-900/75">
            {content}
          </p>

          {/* Video */}
          {post.video_url && (
            <video
              src={post.video_url}
              controls
              preload="metadata"
              className="mt-6 aspect-video w-full rounded-lg bg-black"
            />
          )}

          {/* Close CTA at bottom */}
          <div className={cn('mt-8 flex', ar ? 'justify-start' : 'justify-end')}>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-sand-300 px-5 py-2 text-sm font-semibold text-sea-900 hover:bg-sand-100 transition-colors"
            >
              {ar ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Community Client ─────────────────────────────────────────────────────────
export function CommunityClient({ posts }: { posts: CommunityPost[] }) {
  const locale = useLocale()
  const t = useTranslations('community')
  const states = useTranslations('states')
  const ar = locale === 'ar'
  const [filter, setFilter] = useState<PostCategory | 'all'>('all')
  const [openPost, setOpenPost] = useState<CommunityPost | null>(null)

  const categories = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category))),
    [posts],
  )

  const sorted = useMemo(
    () =>
      posts
        .filter((post) => filter === 'all' || post.category === filter)
        .sort(
          (a, b) =>
            Number(b.is_pinned) - Number(a.is_pinned) ||
            a.sort_order - b.sort_order ||
            b.created_at.localeCompare(a.created_at),
        ),
    [posts, filter],
  )

  const handleOpen = useCallback((post: CommunityPost) => setOpenPost(post), [])
  const handleClose = useCallback(() => setOpenPost(null), [])

  return (
    <>
      {/* Category filter pills */}
      <div className="no-scrollbar mb-10 flex gap-2 overflow-x-auto pb-2">
        {(['all', ...categories] as const).map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            aria-pressed={filter === category}
            className={cn(
              'min-h-11 shrink-0 rounded-md border px-4 py-2 text-sm font-semibold transition-colors',
              filter === category
                ? 'border-sun-500 bg-sun-500 text-white'
                : 'border-sand-300 bg-sand-50 text-sea-900/70 hover:border-sun-400 hover:text-sea-900',
            )}
          >
            {category === 'all'
              ? t('categories.all')
              : POST_CATEGORY_LABELS[category][ar ? 'ar' : 'en']}
          </button>
        ))}
      </div>

      {/* Post grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-12">
        {sorted.map((post, index) => {
          const Icon = icons[post.category] || Compass
          const featured = index === 0 && filter === 'all'
          const content = ar ? post.content_ar : post.content_en
          const wordCount = content.trim().split(/\s+/).filter(Boolean).length
          const readingMinutes = Math.max(1, Math.ceil(wordCount / 200))

          return (
            <Reveal
              key={post.id}
              delay={(index % 6) * 50}
              className={featured ? 'md:col-span-2 lg:col-span-8' : 'lg:col-span-4'}
            >
              <article
                className={cn(
                  'group relative h-full overflow-hidden border bg-[#fffdf8] hover:shadow-md transition-shadow',
                  post.is_pinned ? 'border-sun-400' : 'border-sand-300',
                )}
              >
                {/* Quick-preview button — supplementary to the real link below,
                    stays keyboard/screen-reader accessible as its own control
                    and never intercepts the card's primary navigation. */}
                <button
                  type="button"
                  onClick={() => handleOpen(post)}
                  aria-label={`${ar ? 'معاينة سريعة' : 'Quick preview'}: ${ar ? post.title_ar : post.title_en}`}
                  className={cn(
                    'absolute top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow-md opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:bg-white',
                    ar ? 'left-3' : 'right-3',
                  )}
                >
                  <Eye className="h-4 w-4 text-sea-900" />
                </button>

                {/* Primary navigation — real link to the article page. Posts
                    without a slug (shouldn't happen after the backfill, but
                    guarded defensively) fall back to opening the modal. */}
                {post.slug ? (
                  <Link
                    href={`/community/${post.slug}`}
                    className="absolute inset-0 z-0"
                    aria-label={`${ar ? 'اقرأ المنشور' : 'Read post'}: ${ar ? post.title_ar : post.title_en}`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpen(post)}
                    className="absolute inset-0 z-0"
                    aria-label={`${ar ? 'اقرأ المنشور' : 'Read post'}: ${ar ? post.title_ar : post.title_en}`}
                  />
                )}

                {post.image_url && (
                  <div
                    className={cn(
                      'overflow-hidden bg-sand-200',
                      featured ? 'aspect-[16/8]' : 'aspect-[4/3]',
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt={ar ? post.title_ar : post.title_en}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
                    />
                  </div>
                )}
                <div className={cn('p-6', featured && 'md:p-8')}>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-sea-900/50">
                    <span className="inline-flex items-center gap-1.5 font-semibold text-sun-600">
                      <Icon className="h-3.5 w-3.5" />
                      {POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']}
                    </span>
                    {post.is_pinned && (
                      <span className="inline-flex items-center gap-1">
                        <Pin className="h-3 w-3" />
                        {t('pinned')}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(post.created_at).toLocaleDateString(
                        ar ? 'ar-EG' : 'en-GB',
                      )}
                    </span>
                    <span>
                      {readingMinutes} {ar ? 'د قراءة' : 'min read'}
                    </span>
                  </div>
                  <h2
                    className={cn(
                      'mt-4 font-display font-bold leading-tight text-sea-900',
                      featured ? 'text-3xl md:text-4xl' : 'text-2xl',
                    )}
                  >
                    {ar ? post.title_ar : post.title_en}
                  </h2>
                  {/* Teaser — always clamped; full content in modal */}
                  <p className="mt-4 line-clamp-4 whitespace-pre-line leading-relaxed text-sea-900/68">
                    {content}
                  </p>
                  {(wordCount > 45 || post.video_url) && (
                    <span className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-sun-600 hover:text-sun-500 pointer-events-none">
                      <BookOpen className="h-4 w-4" />
                      {t('readMore')}
                    </span>
                  )}
                </div>
              </article>
            </Reveal>
          )
        })}
      </div>

      {sorted.length === 0 && (
        <div className="border border-sand-300 py-16 text-center text-sea-900/50">
          {states('noContent')}
        </div>
      )}

      {/* Modal */}
      {openPost && (
        <PostModal post={openPost} ar={ar} onClose={handleClose} />
      )}
    </>
  )
}
