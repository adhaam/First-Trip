'use client'

import { useMemo, useState } from 'react'
import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Minus, Plus, ShoppingBag, Check, PackageX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from './CartProvider'
import type { CommerceProduct, CommerceProductVariant } from '@/lib/commerce-types'
import type { CartMerchItem } from '@/lib/commerce-types'
import { formatAmount } from '@/lib/format'

export function ProductDetailClient({ product }: { product: CommerceProduct }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const commerce = useTranslations('commerce')
  const common = useTranslations('common')
  const cart = useCart()

  const options = product.commerce_product_options || []
  const variants = useMemo(() => product.commerce_product_variants || [], [product.commerce_product_variants])
  const hasOptions = options.length > 0

  const [selected, setSelected] = useState<Record<string, string>>({})
  const [activeImage, setActiveImage] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [justAdded, setJustAdded] = useState(false)

  const allOptionsSelected = options.every((o) => selected[o.id])

  const matchedVariant: CommerceProductVariant | undefined = useMemo(() => {
    if (!hasOptions) return variants[0]
    if (!allOptionsSelected) return undefined
    const selectedIds = new Set(Object.values(selected))
    return variants.find((v) => {
      const vIds = new Set(v.option_value_ids)
      return vIds.size === selectedIds.size && [...selectedIds].every((id) => vIds.has(id))
    })
  }, [hasOptions, allOptionsSelected, selected, variants])

  const price = matchedVariant?.price_override != null ? Number(matchedVariant.price_override) : Number(product.base_price)
  const stock = matchedVariant ? matchedVariant.inventory_quantity : null
  const outOfStock = product.track_inventory && matchedVariant != null && stock !== null && stock <= 0
  const canAdd = (!hasOptions || matchedVariant) && !outOfStock

  const images = product.images?.length ? product.images : ['/media/heroposter.webp']

  const addToCart = () => {
    if (!canAdd) return
    const optionSummaryAr = options.map((o) => {
      const valId = selected[o.id]
      const val = o.commerce_product_option_values.find((v) => v.id === valId)
      return val?.value_ar
    }).filter(Boolean).join(' / ')
    const optionSummaryEn = options.map((o) => {
      const valId = selected[o.id]
      const val = o.commerce_product_option_values.find((v) => v.id === valId)
      return val?.value_en
    }).filter(Boolean).join(' / ')

    const item: CartMerchItem = {
      kind: 'merch',
      lineId: `${product.id}:${matchedVariant?.id || 'default'}:${Date.now()}`,
      productId: product.id,
      variantId: matchedVariant?.id || null,
      slug: product.slug,
      nameAr: product.name_ar,
      nameEn: product.name_en,
      image: matchedVariant?.image_url || images[0],
      optionSummaryAr,
      optionSummaryEn,
      unitPriceEstimate: price,
      quantity,
    }
    cart.add(item)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1800)
  }

  return (
    <div className="bg-sand-50">
      <div className="container-main grid gap-8 py-8 md:grid-cols-2 md:py-12">
        {/* Gallery */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-sand-300 bg-white">
            <Image src={images[activeImage]} alt={ar ? product.name_ar : product.name_en} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            {product.badge_text && (
              <span className="absolute start-3 top-3 rounded-full bg-sun-500 px-3 py-1 text-xs font-semibold text-on-accent shadow">
                {product.badge_text}
              </span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img + i}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={cn(
                    'relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2',
                    activeImage === i ? 'border-sun-600' : 'border-transparent',
                  )}
                >
                  <Image src={img} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.commerce_categories && (
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              {ar ? product.commerce_categories.name_ar : product.commerce_categories.name_en}
            </p>
          )}
          <h1 className="mt-2 font-display text-3xl font-extrabold text-sea-900">{ar ? product.name_ar : product.name_en}</h1>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-sea-900">{formatAmount(price, locale)} {common('egp')}</span>
            {product.compare_at_price && Number(product.compare_at_price) > price && (
              <span className="text-sm text-ink-subtle line-through">{formatAmount(Number(product.compare_at_price), locale)} {common('egp')}</span>
            )}
          </div>

          {(ar ? product.description_ar : product.description_en) && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
              {ar ? product.description_ar : product.description_en}
            </p>
          )}

          {/* Options */}
          {options.map((option) => (
            <div key={option.id} className="mt-5">
              <p className="mb-2 text-sm font-semibold text-sea-900">{ar ? option.name_ar : option.name_en}</p>
              <div className="flex flex-wrap gap-2">
                {option.commerce_product_option_values.map((val) => (
                  <button
                    key={val.id}
                    type="button"
                    onClick={() => setSelected((prev) => ({ ...prev, [option.id]: val.id }))}
                    aria-pressed={selected[option.id] === val.id}
                    className={cn(
                      'min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors',
                      selected[option.id] === val.id
                        ? 'border-sun-600 bg-sun-500 text-on-accent'
                        : 'border-sand-300 bg-white text-ink-muted hover:border-sea-400',
                    )}
                  >
                    {ar ? val.value_ar : val.value_en}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {hasOptions && !allOptionsSelected && (
            <p className="mt-3 text-xs text-ink-subtle">{commerce('selectOptions')}</p>
          )}
          {hasOptions && allOptionsSelected && !matchedVariant && (
            <p className="mt-3 text-xs font-medium text-red-600">{commerce('outOfStock')}</p>
          )}
          {matchedVariant && product.track_inventory && stock !== null && stock > 0 && stock <= 5 && (
            <p className="mt-3 text-xs font-medium text-sun-700">{commerce('unitsLeft', { count: stock })}</p>
          )}
          {outOfStock && (
            <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-600">
              <PackageX className="h-3.5 w-3.5" /> {commerce('outOfStock')}
            </p>
          )}

          {/* Quantity */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-sm font-semibold text-sea-900">{commerce('quantity')}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sand-300 hover:bg-sand-100">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity((q) => (stock !== null ? Math.min(stock, q + 1) : q + 1))}
                disabled={stock !== null && quantity >= stock}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-sea-500 text-sea-700 hover:bg-sea-50 disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={addToCart}
            disabled={!canAdd}
            className={cn(
              'mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-sand-300',
              justAdded ? 'bg-emerald-600' : 'bg-sun-500 hover:bg-sun-600',
            )}
          >
            {justAdded ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
            {justAdded ? commerce('addedToCart') : commerce('addToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}
