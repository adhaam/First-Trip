'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { ShoppingBag, Filter, Search } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { ProductCard } from '@/components/commerce/ProductCard'
import { cn } from '@/lib/utils'
import type { CommerceCategory, CommerceCollection, CommerceProduct } from '@/lib/commerce-types'

interface Props {
  products: CommerceProduct[]
  categories: CommerceCategory[]
  collections: (CommerceCollection & { product_ids: string[] })[]
}

export function MerchClient({ products, categories, collections }: Props) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const commerce = useTranslations('commerce')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [query, setQuery] = useState('')

  const applicableCategories = categories.filter((c) => c.applies_to !== 'rental')

  const filtered = useMemo(() => {
    let list = products
    if (categoryId !== 'all') list = list.filter((p) => p.category_id === categoryId)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => `${p.name_ar} ${p.name_en}`.toLowerCase().includes(q))
    }
    return list
  }, [products, categoryId, query])

  const activeCollections = collections.filter((c) => c.product_ids.length > 0)

  return (
    <div className="bg-sand-50">
      {/* Hero */}
      <section className="relative isolate flex min-h-[52svh] items-end overflow-hidden bg-sea-900 py-14 text-white md:items-center md:py-20">
        <Image src="/media/heroposter.png" alt="" fill sizes="100vw" className="-z-20 object-cover" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/20 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <ShoppingBag className="mb-5 h-8 w-8 text-sun-300" />
          <p className="eyebrow text-sun-300">WEEMAP MERCH</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-none sm:text-5xl md:text-6xl">
            {commerce('merchHeroTitle')}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/75">{commerce('merchHeroSubtitle')}</p>
        </div>
      </section>

      <div className="container-main py-10">
        {/* Collections rail */}
        {activeCollections.length > 0 && (
          <div className="no-scrollbar mb-8 flex gap-3 overflow-x-auto pb-1">
            {activeCollections.map((c) => (
              <div key={c.id} className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-sand-300">
                {c.image_url && <Image src={c.image_url} alt="" fill sizes="160px" className="object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-t from-sea-900/70 to-transparent" />
                <span className="absolute inset-x-2 bottom-2 text-sm font-bold text-white">{ar ? c.name_ar : c.name_en}</span>
              </div>
            ))}
          </div>
        )}

        {/* Search + category filter */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sea-900/35" />
            <input
              type="search"
              aria-label={commerce('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={commerce('searchPlaceholder')}
              className="h-11 w-full rounded-full border border-sand-300 bg-white ps-9 pe-4 text-sm text-sea-900 placeholder:text-sea-900/35 focus:border-sea-500 focus:outline-none"
            />
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <Filter className="h-4 w-4 shrink-0 text-sea-900/35" />
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={cn(
                'min-h-9 shrink-0 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                categoryId === 'all' ? 'bg-sun-500 text-white' : 'border border-sand-300 bg-white text-sea-900/60 hover:text-sea-900',
              )}
            >
              {commerce('allCategories')}
            </button>
            {applicableCategories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoryId(c.id)}
                className={cn(
                  'min-h-9 shrink-0 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                  categoryId === c.id ? 'bg-sun-500 text-white' : 'border border-sand-300 bg-white text-sea-900/60 hover:text-sea-900',
                )}
              >
                {ar ? c.name_ar : c.name_en}
              </button>
            ))}
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState text={commerce('noProducts')} />
        ) : filtered.length === 0 ? (
          <EmptyState text={commerce('noProductMatches')} />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p, i) => (
              <Reveal key={p.id} delay={(i % 8) * 50}>
                <ProductCard product={p} />
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-sand-300 bg-white/50 py-20 text-center">
      <ShoppingBag className="h-8 w-8 text-sand-400" />
      <p className="max-w-xs text-sm text-sea-900/50">{text}</p>
    </div>
  )
}
