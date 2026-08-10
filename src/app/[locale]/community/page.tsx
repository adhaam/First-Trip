'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'
import { MOCK_COMMUNITY_POSTS } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { Pin, Calendar, BookOpen, Sparkles, BookHeart, Map, type LucideIcon } from 'lucide-react'

const categoryIcons: Record<string, LucideIcon> = {
  'blog': BookOpen,
  'hidden-gems': Sparkles,
  'stories': BookHeart,
  'dahab-guide': Map,
}

export default function CommunityPage() {
  const t = useTranslations('community')
  const locale = useLocale()
  const [filter, setFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const categories = [
    { id: 'all', key: 'all' as const, icon: BookOpen },
    { id: 'blog', key: 'blog', icon: BookOpen },
    { id: 'hidden-gems', key: 'hiddenGems', icon: Sparkles },
    { id: 'stories', key: 'stories', icon: BookHeart },
    { id: 'dahab-guide', key: 'dahabGuide', icon: Map },
  ]

  const filtered = filter === 'all'
    ? MOCK_COMMUNITY_POSTS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : MOCK_COMMUNITY_POSTS.filter(p => p.category === filter)

  // Sort: pinned first, then by sort_order, then by created_at
  const sorted = [...filtered].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1
    if (!a.is_pinned && b.is_pinned) return 1
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white py-20 md:py-24 text-center">
        <div className="container-main">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
            <p className="text-lg text-blue-100 max-w-2xl mx-auto">{t('subtitle')}</p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-main max-w-3xl">
          {/* Filter Tabs */}
          <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
            {categories.map(cat => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => setFilter(cat.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                    filter === cat.id
                      ? 'bg-brand-blue text-white shadow-sm'
                      : 'bg-white text-gray-600 hover:bg-gray-100 border'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {cat.key === 'all' ? (locale === 'ar' ? 'الكل' : 'All') : t(`categories.${cat.key}` as 'blog')}
                </button>
              )
            })}
          </div>

          {/* News Feed */}
          <div className="space-y-6">
            {sorted.map((post, i) => {
              const Icon = categoryIcons[post.category]
              return (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <Card className={cn('overflow-hidden hover:shadow-md transition-shadow', post.is_pinned && 'ring-2 ring-brand-orange')}>
                    {post.image_url && (
                      <div className="relative h-56 w-full overflow-hidden bg-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        {post.is_pinned && (
                          <Badge className="bg-brand-orange text-white">
                            <Pin className="h-3 w-3 mr-1" />
                            {t('pinned')}
                          </Badge>
                        )}
                        <Badge variant="outline" className="border-brand-blue/30 text-brand-blue">
                          <Icon className="h-3 w-3 mr-1" />
                          {t(`categories.${post.category === 'dahab-guide' ? 'dahabGuide' : post.category === 'hidden-gems' ? 'hiddenGems' : post.category as 'blog' | 'stories'}`)}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.created_at).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {locale === 'ar' ? post.title_ar : post.title_en}
                      </h3>
                      <p className={`text-gray-600 leading-relaxed ${expandedId === post.id ? '' : 'line-clamp-4'}`}>
                        {locale === 'ar' ? post.content_ar : post.content_en}
                      </p>
                      <button
                        onClick={() => setExpandedId(expandedId === post.id ? null : post.id)}
                        className="inline-flex items-center gap-1 px-0 mt-2 text-brand-blue font-medium text-sm hover:text-brand-blue-dark transition-colors"
                      >
                        {expandedId === post.id
                          ? (locale === 'ar' ? 'عرض أقل ↑' : 'Show Less ↑')
                          : `${t('readMore')} →`}
                      </button>
                    </CardContent>
                  </Card>
                </motion.div>
              )
            })}

            {sorted.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                {locale === 'ar' ? 'لا يوجد محتوى في هذه الفئة بعد' : 'No content in this category yet'}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}