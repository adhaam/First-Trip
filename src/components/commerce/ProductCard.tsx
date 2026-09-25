'use client'

import { SafeImage as Image } from '@/components/SafeImage'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { PackageX } from 'lucide-react'
import { GlowCard } from '@/components/motion/Reveal'
import { ArrowForward } from '@/components/brand'
import { cn } from '@/lib/utils'
import type { CommerceProduct } from '@/lib/commerce-types'
import { cheapestRentalTier, isOutOfStock, productMinPrice, rentalDurationLabel } from '@/lib/shop-view'
import { formatAmount } from '@/lib/format'

/**
 * The one card shape for Merch + Rent listings — visually a sibling of
 * `<EditorialCard>` (same image-bleed / gradient / hover-lift language) but
 * with its own price-and-stock footer, which `<EditorialCard>`'s generic
 * `meta` slot can't express (a variant-aware price, an out-of-stock scrim, a
 * rental "from / duration" pairing).
 *
 * `featured` gives the grid's first card a taller image and larger title —
 * the same "one hero card beside smaller ones" hierarchy `<EditorialCard>`
 * and `<AccommodationCard>` use elsewhere, so Merch/Rent read as curated
 * rather than a wall of identical tiles (see docs/m2/BRIEF.md).
 */
export function ProductCard({ product, featured = false, priority = false, className }: {
  product: CommerceProduct
  featured?: boolean
  priority?: boolean
  className?: string
}) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const shop = useTranslations('shopV2')
  const common = useTranslations('common')

  const name = ar ? product.name_ar : product.name_en
  const cover = product.images?.[0] || '/media/heroposter.webp'
  const category = product.commerce_categories ? (ar ? product.commerce_categories.name_ar : product.commerce_categories.name_en) : null
  const href = product.product_type === 'sale' ? `/merch/${product.slug}` : `/rent/${product.slug}`

  const minPrice = productMinPrice(product)
  const hasVariants = (product.commerce_product_variants || []).length > 0
  const tier = product.product_type === 'rental' ? cheapestRentalTier(product) : null
  const outOfStock = isOutOfStock(product)

  return (
    <GlowCard className={cn('h-full', className)}>
      <Link href={href} aria-label={name} className="group block h-full rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-500 focus-visible:ring-offset-3">
        <article className="hover-lift flex h-full flex-col overflow-hidden border-[1.5px] border-sand-300 bg-card pin-card">
          <div className={cn('slow-zoom relative overflow-hidden', featured ? 'aspect-[16/9] sm:aspect-[21/9]' : 'aspect-[4/3]')}>
            <Image
              src={cover}
              alt=""
              fill
              priority={priority}
              sizes={featured ? '(max-width: 640px) 100vw, 66vw' : '(max-width: 640px) 85vw, (max-width: 1024px) 45vw, 30vw'}
              className="object-cover"
            />
            <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-sea-900/80 via-sea-900/10 to-transparent" />

            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              {category ? (
                <span className="rounded-full bg-sand-50/95 px-3 py-1 text-[0.7rem] font-semibold text-sea-900 backdrop-blur">
                  {category}
                </span>
              ) : <span />}
              {product.badge_text && (
                <span className="rounded-full bg-sun-500 px-3 py-1 text-[0.7rem] font-semibold text-on-accent shadow">
                  {product.badge_text}
                </span>
              )}
            </div>

            {outOfStock && (
              <div className="absolute inset-0 flex items-center justify-center bg-sea-900/55">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-sea-900">
                  <PackageX className="h-3.5 w-3.5" aria-hidden />
                  {shop('outOfStock')}
                </span>
              </div>
            )}

            <h3 className={cn('absolute inset-x-4 bottom-3 line-clamp-2 font-display font-bold leading-snug text-white drop-shadow', featured ? 'text-2xl sm:text-3xl' : 'text-lg')}>
              {name}
            </h3>
          </div>

          <div className="flex flex-1 flex-col p-5">
            <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">
              {ar ? product.description_ar : product.description_en}
            </p>

            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <div className="font-display text-lg font-bold text-sea-900">
                {product.product_type === 'rental' ? (
                  tier ? (
                    <>
                      <span className="text-xs font-medium text-ink-subtle">{shop('from')} </span>
                      {formatAmount(Number(tier.price), locale)}
                      <span className="ms-1 text-sm font-semibold text-ink-muted">{common('egp')}</span>
                      <span className="ms-1 text-xs font-medium text-ink-subtle">
                        {shop('perDuration', { duration: rentalDurationLabel({ durationDays: tier.duration_days, labelAr: tier.label_ar, labelEn: tier.label_en }, ar) })}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm font-medium text-ink-subtle">{shop('askForPrice')}</span>
                  )
                ) : (
                  <>
                    {hasVariants && minPrice !== Number(product.base_price) && (
                      <span className="text-xs font-medium text-ink-subtle">{shop('from')} </span>
                    )}
                    {formatAmount(minPrice, locale)} <span className="text-sm font-semibold text-ink-muted">{common('egp')}</span>
                    {product.compare_at_price && Number(product.compare_at_price) > minPrice && (
                      <span className="ms-1.5 text-xs font-medium text-ink-subtle line-through">
                        {formatAmount(Number(product.compare_at_price), locale)}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span
                aria-hidden
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-sun-600 px-4 py-2 text-xs font-semibold text-sun-700 transition-colors group-hover:bg-sun-500 group-hover:text-on-accent"
              >
                {product.product_type === 'rental' ? shop('chooseDates') : shop('view')}
                <ArrowForward className="h-3.5 w-3.5" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </GlowCard>
  )
}
