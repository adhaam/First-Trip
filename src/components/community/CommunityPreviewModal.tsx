'use client'

import { useEffect, useRef } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Calendar, Pin, X } from 'lucide-react'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { POST_CATEGORY_LABELS } from '@/lib/community'
import { COMMUNITY_CATEGORY_ICONS } from './category-icons'
import type { CommunityPost } from '@/lib/types'

/**
 * Fallback reading surface for a slug-less post (see
 * `<CommunityPreviewCard>`) — the ONLY place this app still shows a post in
 * a modal instead of navigating to it.
 */
export function CommunityPreviewModal({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  const t = useTranslations('communityV2')
  const locale = useLocale()
  const ar = locale === 'ar'
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const Icon = COMMUNITY_CATEGORY_ICONS[post.category]
  const content = ar ? post.content_ar : post.content_en

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-sea-900/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="community-preview-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-2xl bg-sand-50 shadow-2xl sm:max-h-[85dvh]"
        onKeyDown={handleKeyDown}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t('backToCommunity')}
          className={cn('absolute top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/85 shadow-md transition-colors hover:bg-white', 'end-3')}
        >
          <X className="h-4 w-4 text-sea-900" aria-hidden />
        </button>

        {post.image_url && (
          <div className="aspect-[16/9] w-full shrink-0 overflow-hidden bg-sand-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.image_url} alt={ar ? post.title_ar : post.title_en} className="h-full w-full object-cover" />
          </div>
        )}

        <div className="flex-1 p-6 md:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
            <span className="inline-flex items-center gap-1.5 font-semibold text-sun-700">
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {POST_CATEGORY_LABELS[post.category][ar ? 'ar' : 'en']}
            </span>
            {post.is_pinned && (
              <span className="inline-flex items-center gap-1">
                <Pin className="h-3 w-3" aria-hidden />
                {t('pinnedBadge')}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" aria-hidden />
              {formatDate(post.created_at, locale)}
            </span>
          </div>

          <h2 id="community-preview-title" className="mb-5 font-display text-2xl font-bold leading-tight text-sea-900 md:text-3xl">
            {ar ? post.title_ar : post.title_en}
          </h2>

          <p className="whitespace-pre-line leading-relaxed text-ink-muted">{content}</p>

          {post.video_url && (
            <video src={post.video_url} controls preload="metadata" className="mt-6 aspect-video w-full rounded-lg bg-black" />
          )}
        </div>
      </div>
    </div>
  )
}
