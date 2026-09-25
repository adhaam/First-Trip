'use client'

import { useLocale, useTranslations } from 'next-intl'
import { SafeImage as Image } from '@/components/SafeImage'
import { Link } from '@/i18n/navigation'
import { ButtonLink } from '@/components/ButtonLink'
import { Section, SectionHeading } from '@/components/brand/Section'
import { ArrowForward } from '@/components/brand/DirectionalIcon'
import { Reveal, GlowCard } from '@/components/motion/Reveal'
import type { CommunityPost } from '@/lib/types'

const PICK_COUNT = 3

/** An editorial spread of community posts — never a bare list of links. */
export function CommunitySpread({ posts }: { posts: CommunityPost[] }) {
  const t = useTranslations('homeV2.community')
  const locale = useLocale()
  const ar = locale === 'ar'
  const picks = posts.slice(0, PICK_COUNT)

  if (picks.length === 0) return null

  return (
    <Section tone="paper">
      <SectionHeading
        eyebrow={t('eyebrow')}
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <ButtonLink href="/community" variant="outline-ink" size="lg">
            {t('cta')}
          </ButtonLink>
        }
      />

      <div className="grid gap-5 md:grid-cols-3">
        {picks.map((post, i) => {
          const title = ar ? post.title_ar : post.title_en
          const excerpt = ar ? post.content_ar : post.content_en
          const href = post.slug ? `/community/${post.slug}` : '/community'
          return (
            <Reveal key={post.id} delay={i * 80} className="h-full">
              <GlowCard className="h-full">
                <Link href={href} className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-2">
                  {post.image_url && (
                    <div className="relative aspect-[16/10] overflow-hidden">
                      <Image
                        src={post.image_url}
                        alt={title}
                        fill
                        sizes="(max-width: 768px) 100vw, 33vw"
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-base font-semibold leading-snug text-sea-900">{title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted">{excerpt}</p>
                    <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-sea-600 transition-colors group-hover:text-sun-700">
                      {t('readMore')}
                      <ArrowForward className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </GlowCard>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
