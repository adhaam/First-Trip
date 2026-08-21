'use client'

import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowUpRight, PackageX } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import type { CommerceProduct } from '@/lib/commerce-types'

function cheapestTier(product: CommerceProduct) {
  const tiers = product.rental_pricing_tiers?.filter((t) => t.variant_id === null) || []
  if (tiers.length === 0) return null
  return tiers.reduce((min, t) => (Number(t.price) < Number(min.price) ? t : min), tiers[0])
}

export function ProductCard({ product, featured = false, className }: {
  product: CommerceProduct
  featured?: boolean
  className?: string
}) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const common = useTranslations('common')
  const commerce = useTranslations('commerce')

  const name = ar ? product.name_ar : product.name_en
  const cover = product.images?.[0] || '/media/heroposter.png'
  const category = product.commerce_categories ? (ar ? product.commerce_categories.name_ar : product.commerce_categories.name_en) : null
  const href = product.product_type === 'sale' ? `/merch/${product.slug}` : `/rent/${product.slug}`

  const variants = product.commerce_product_variants || []
  const hasVariants = variants.length > 0
  const minVariantPrice = hasVariants
    ? Math.min(...variants.map((v) => (v.price_override != null ? Number(v.price_override) : Number(product.base_price))))
    : Number(product.base_price)
  const tier = product.product_type === 'rental' ? cheapestTier(product) : null
  const outOfStock =
    product.product_type === 'sale' &&
    product.track_inventory &&
    hasVariants &&
    variants.every((v) => v.inventory_quantity <= 0)

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link href={href} aria-label={name} className="block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3">
        <article className="hover-lift group flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
          <div className={cn('relative overflow-hidden', featured ? 'aspect-[16/8]' : 'aspect-[4/3]')}>
            <Image
              src={cover}
              alt={name}
              fill
              sizes="(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw"
              className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.07]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-sea-900/50 to-transparent" />

            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              {category ? (
                <span className="rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
                  {category}
                </span>
              ) : <span />}
              {product.badge_text && (
                <span className="rounded-full bg-sun-500 px-3 py-1 text-[0.7rem] font-semibold text-white shadow">
                  {product.badge_text}
                </span>
              )}
            </div>

            {outOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-sea-900/55">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-sea-900">
                  <PackageX className="h-3.5 w-3.5" />
                  {commerce('outOfStock')}
                </span>
              </div>
            )}

            <h3 className="absolute inset-x-4 bottom-3 line-clamp-2 font-display text-lg font-bold leading-snug text-white drop-shadow">
              {name}
            </h3>
          </div>

          <div className="flex flex-1 flex-col p-5">
            <p className="line-clamp-2 text-sm leading-relaxed text-sea-900/60">
              {ar ? product.description_ar : product.description_en}
            </p>

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <div className="font-display text-lg font-bold text-sea-900">
                {product.product_type === 'rental' ? (
                  tier ? (
                    <>
                      <span className="text-xs font-medium text-sea-900/50">{commerce('from')} </span>
                      {Number(tier.price).toLocaleString()} <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
                      <span className="text-xs font-medium text-sea-900/50"> / {ar ? (tier.label_ar || `${tier.duration_days} يوم`) : (tier.label_en || `${tier.duration_days}d`)}</span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-sea-900/50">{commerce('contactForPrice')}</span>
                  )
                ) : (
                  <>
                    {hasVariants && minVariantPrice !== Number(product.base_price) && (
                      <span className="text-xs font-medium text-sea-900/50">{commerce('from')} </span>
                    )}
                    {minVariantPrice.toLocaleString()} <span className="text-sm font-semibold text-sea-900/70">{common('egp')}</span>
                    {product.compare_at_price && Number(product.compare_at_price) > minVariantPrice && (
                      <span className="ms-1.5 text-xs font-medium text-sea-900/35 line-through">
                        {Number(product.compare_at_price).toLocaleString()}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-sun-500 px-4 py-2 text-xs font-semibold text-sun-600 transition-colors hover:bg-sun-500 hover:text-white">
                {product.product_type === 'rental' ? commerce('chooseDates') : commerce('view')}
                <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
