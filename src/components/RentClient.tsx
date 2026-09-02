'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { KeyRound, Filter, Search } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { ProductCard } from '@/components/commerce/ProductCard'
import { cn } from '@/lib/utils'
import type { CommerceCategory, CommerceProduct } from '@/lib/commerce-types'
import { EmptyState } from '@/components/EmptyState'

interface Props {
  products: CommerceProduct[]
  categories: CommerceCategory[]
}

export function RentClient({ products, categories }: Props) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const commerce = useTranslations('commerce')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [query, setQuery] = useState('')

  const applicableCategories = categories.filter((c) => c.applies_to !== 'sale')

  const filtered = useMemo(() => {
    let list = products
    if (categoryId !== 'all') list = list.filter((p) => p.category_id === categoryId)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((p) => `${p.name_ar} ${p.name_en}`.toLowerCase().includes(q))
    }
    return list
  }, [products, categoryId, query])

  return (
    <div className="bg-sand-50">
      <section className="relative isolate flex min-h-[52svh] items-end overflow-hidden bg-sea-900 py-14 text-white md:items-center md:py-20">
        <Image src="/media/heroposter.webp" alt="" fill sizes="100vw" className="-z-20 object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/60 to-black/20 rtl:bg-gradient-to-l" />
        <div className="container-main">
          <KeyRound className="mb-5 h-8 w-8 text-sun-300" />
          <p className="eyebrow text-sun-300">WEEMAP RENTAL</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-extrabold leading-none sm:text-5xl md:text-6xl">
            {commerce('rentHeroTitle')}
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-white/75">{commerce('rentHeroSubtitle')}</p>
        </div>
      </section>

      <div className="container-main py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              aria-label={commerce('searchPlaceholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={commerce('searchPlaceholder')}
              className="h-11 w-full rounded-full border border-sand-300 bg-white ps-9 pe-4 text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:border-sea-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sun-700"
            />
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
            <Filter className="h-4 w-4 shrink-0 text-ink-subtle" />
            <button
              type="button"
              onClick={() => setCategoryId('all')}
              className={cn(
                'min-h-9 shrink-0 rounded-md px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
                categoryId === 'all' ? 'bg-sun-500 text-on-accent' : 'border border-sand-300 bg-white text-ink-muted hover:text-sea-900',
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
                  categoryId === c.id ? 'bg-sun-500 text-on-accent' : 'border border-sand-300 bg-white text-ink-muted hover:text-sea-900',
                )}
              >
                {ar ? c.name_ar : c.name_en}
              </button>
            ))}
          </div>
        </div>

        {products.length === 0 ? (
          <EmptyState title={commerce('noRentals')} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title={commerce('noRentalMatches')}
            onClear={query || categoryId !== 'all' ? () => { setQuery(''); setCategoryId('all') } : undefined}
          />
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
