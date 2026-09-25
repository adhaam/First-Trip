'use client'

import { useMemo, useState } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { MessageCircle, ShoppingBag } from 'lucide-react'
import { Reveal } from '@/components/motion/Reveal'
import { ProductCard } from '@/components/commerce/ProductCard'
import { EmptyState, ResultCount } from '@/components/EmptyState'
import { ButtonLink } from '@/components/ButtonLink'
import { PageHero, Eyebrow, Chip, ChipRail, FilterSheet, SearchInput } from '@/components/brand'
import { applicableCategories, catalogView, filterCatalog, sortCatalog, type CatalogSort } from '@/lib/shop-view'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import type { CommerceCategory, CommerceCollection, CommerceProduct } from '@/lib/commerce-types'

interface Props {
  products: CommerceProduct[]
  categories: CommerceCategory[]
  collections: (CommerceCollection & { product_ids: string[] })[]
  whatsapp?: string | null
}

const SORTS: CatalogSort[] = ['featured', 'price_asc', 'price_desc', 'name']

export function MerchClient({ products, categories, collections, whatsapp }: Props) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const shop = useTranslations('shopV2')
  const [categoryId, setCategoryId] = useState<string>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CatalogSort>('featured')

  const applicableCats = applicableCategories(categories, 'sale')
  const activeCollections = collections.filter((c) => c.product_ids.length > 0)

  const filtered = useMemo(
    () => sortCatalog(filterCatalog(products, { categoryId, query }), sort),
    [products, categoryId, query, sort],
  )

  const hasFilters = query.trim() !== ''
  const number = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const waMessage = ar ? 'مرحباً WEEMAP، عايز أعرف التشكيلة الجديدة إمتى هتظهر' : "Hi WEEMAP, I'd like to know when the new drop lands"

  const sortLabel = (s: CatalogSort) =>
    shop(`sort${s === 'featured' ? 'Featured' : s === 'price_asc' ? 'PriceAsc' : s === 'price_desc' ? 'PriceDesc' : 'Name'}`)

  return (
    <div className="bg-sand-50">
      <PageHero
        image="/media/heroposter.webp"
        eyebrow={<Eyebrow tone="light">{shop('merchEyebrow')}</Eyebrow>}
        title={shop('merchTitle')}
        lede={shop('merchLede')}
        size="md"
      />

      <div className="container-main py-10 sm:py-14">
        {catalogView(products) === 'curating' ? (
          <EmptyState
            variant="curating"
            title={shop('curatingMerchTitle')}
            hint={shop('curatingMerchHint')}
            action={
              <div className="flex flex-wrap items-center justify-center gap-3">
                <ButtonLink href="/plan" variant="sun" size="lg">{shop('buildTripCta')}</ButtonLink>
                <ButtonLink href="/sinai-trips" variant="outline-ink" size="lg">{shop('exploreTripsCta')}</ButtonLink>
                <ButtonLink
                  href={`https://wa.me/${number}?text=${encodeURIComponent(waMessage)}`}
                  variant="whatsapp"
                  size="lg"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden />
                  {shop('askOnWhatsapp')}
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <>
            {activeCollections.length > 0 && (
              <div className="mb-8">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-subtle">{shop('collectionsLabel')}</p>
                <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
                  {activeCollections.map((c) => (
                    <div key={c.id} className="relative h-24 w-40 shrink-0 overflow-hidden rounded-xl border border-sand-300">
                      {c.image_url && <Image src={c.image_url} alt="" fill sizes="160px" className="object-cover" />}
                      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-sea-900/70 to-transparent" />
                      <span className="absolute inset-x-2 bottom-2 text-sm font-bold text-white">{ar ? c.name_ar : c.name_en}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <ChipRail>
                  <Chip selected={categoryId === 'all'} onClick={() => setCategoryId('all')}>
                    {shop('allCategories')}
                  </Chip>
                  {applicableCats.map((c) => (
                    <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
                      {ar ? c.name_ar : c.name_en}
                    </Chip>
                  ))}
                </ChipRail>
                <FilterSheet
                  title={shop('sortLabel')}
                  triggerLabel={shop('sortLabel')}
                  activeCount={sort !== 'featured' ? 1 : 0}
                  onReset={sort !== 'featured' ? () => setSort('featured') : undefined}
                  className="shrink-0"
                >
                  <div className="flex flex-col gap-2">
                    {SORTS.map((s) => (
                      <Chip key={s} selected={sort === s} onClick={() => setSort(s)} className="justify-center">
                        {sortLabel(s)}
                      </Chip>
                    ))}
                  </div>
                </FilterSheet>
              </div>
              <SearchInput
                value={query}
                onChange={setQuery}
                label={shop('searchLabel')}
                placeholder={shop('searchMerchPlaceholder')}
                className="sm:max-w-xs"
              />
            </div>

            <ResultCount count={filtered.length} label={shop('resultsCount', { count: filtered.length })} className="mb-4" />

            {filtered.length === 0 ? (
              <EmptyState
                title={shop('noMatchesTitle')}
                hint={shop('noMatchesHint')}
                icon={<ShoppingBag className="h-8 w-8" aria-hidden />}
                onClear={hasFilters || categoryId !== 'all' ? () => { setQuery(''); setCategoryId('all') } : undefined}
              />
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filtered.map((p, i) => (
                  <Reveal
                    key={p.id}
                    delay={(i % 8) * 50}
                    className={i === 0 && filtered.length >= 3 ? 'col-span-2' : undefined}
                  >
                    <ProductCard product={p} featured={i === 0 && filtered.length >= 3} priority={i === 0} />
                  </Reveal>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
