'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Minus, Plus, KeyRound, Check, ShieldCheck, Truck, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from './CartProvider'
import { quoteRental } from '@/lib/rental-pricing'
import { addRentalDays, todayIso } from '@/lib/cart'
import type { CommerceProduct, CommerceProductVariant, CartRentalItem, DeliveryZone } from '@/lib/commerce-types'

const REQUIREMENT_KEYS: Record<string, string> = {
  id_required: 'requirement_id_required',
  license_required: 'requirement_license_required',
  deposit_required: 'requirement_deposit_required',
}

export function RentalDetailClient({ product, deliveryZones }: { product: CommerceProduct; deliveryZones: DeliveryZone[] }) {
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
  const [startDate, setStartDate] = useState(todayIso())
  const [durationDays, setDurationDays] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>(product.pickup_enabled ? 'pickup' : 'delivery')
  const [zoneId, setZoneId] = useState<string>(deliveryZones[0]?.id || '')
  const [justAdded, setJustAdded] = useState(false)
  const [availability, setAvailability] = useState<{ checking: boolean; remaining: number | null; available: boolean }>({
    checking: false, remaining: null, available: true,
  })

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

  const tiers = (product.rental_pricing_tiers || []).filter((t) =>
    hasOptions ? t.variant_id === (matchedVariant?.id || null) : t.variant_id === null,
  )

  useEffect(() => {
    // Resets the selected duration to the first valid tier whenever the variant changes.
    if (tiers.length > 0 && (durationDays === null || !tiers.some((t) => t.duration_days === durationDays))) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDurationDays(tiers[0].duration_days)
    }
    if (tiers.length === 0) setDurationDays(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedVariant?.id, tiers.length])

  const quote = durationDays
    ? quoteRental({
        tiers: tiers.map((t) => ({ id: t.id, product_id: product.id, variant_id: t.variant_id, duration_days: t.duration_days, price: Number(t.price), is_active: true })),
        variantId: matchedVariant?.id || null,
        requestedDays: durationDays,
        quantity,
      })
    : null

  const endDate = quote ? addRentalDays(startDate, quote.durationDays) : null

  useEffect(() => {
    if (!endDate || (hasOptions && !matchedVariant)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async availability fetch
    setAvailability((prev) => ({ ...prev, checking: true }))
    const controller = new AbortController()
    const params = new URLSearchParams({
      product_id: product.id,
      start_date: startDate,
      end_date: endDate,
      quantity: String(quantity),
    })
    if (matchedVariant?.id) params.set('variant_id', matchedVariant.id)
    fetch(`/api/commerce/availability?${params}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setAvailability({ checking: false, remaining: d.remainingAvailable ?? null, available: Boolean(d.available) }))
      .catch(() => setAvailability({ checking: false, remaining: null, available: true }))
    return () => controller.abort()
  }, [product.id, matchedVariant, startDate, endDate, quantity, hasOptions])

  const showDelivery = product.delivery_enabled && deliveryZones.length > 0
  const showPickup = product.pickup_enabled

  const images = product.images?.length ? product.images : ['/media/heroposter.png']
  const deliveryFee = fulfillment === 'delivery' ? deliveryZones.find((z) => z.id === zoneId) : null
  const deliveryFeeAmount = deliveryFee?.fee_type === 'fixed' ? Number(deliveryFee.fixed_fee) : 0
  const canAdd = quote != null && (!hasOptions || matchedVariant) && availability.available && (fulfillment === 'pickup' || !!zoneId || deliveryZones.length === 0)

  const addToCart = () => {
    if (!canAdd || !quote || !endDate) return
    const optionSummaryAr = options.map((o) => o.commerce_product_option_values.find((v) => v.id === selected[o.id])?.value_ar).filter(Boolean).join(' / ')
    const optionSummaryEn = options.map((o) => o.commerce_product_option_values.find((v) => v.id === selected[o.id])?.value_en).filter(Boolean).join(' / ')
    const tierRow = tiers.find((t) => t.duration_days === quote.durationDays)

    const item: CartRentalItem = {
      kind: 'rental',
      // eslint-disable-next-line react-hooks/purity -- runs inside a click handler, never during render
      lineId: `${product.id}:${matchedVariant?.id || 'default'}:${startDate}:${Date.now()}`,
      productId: product.id,
      variantId: matchedVariant?.id || null,
      slug: product.slug,
      nameAr: product.name_ar,
      nameEn: product.name_en,
      image: matchedVariant?.image_url || images[0],
      optionSummaryAr,
      optionSummaryEn,
      durationDays: quote.durationDays,
      durationLabelAr: tierRow?.label_ar || '',
      durationLabelEn: tierRow?.label_en || '',
      startDate,
      endDate,
      quantity,
      unitPriceEstimate: quote.unitPrice,
    }
    cart.add(item)
    cart.setFulfillmentMethod(fulfillment)
    if (fulfillment === 'delivery' && zoneId) cart.setDeliveryZoneId(zoneId)
    setJustAdded(true)
    setTimeout(() => setJustAdded(false), 1800)
  }

  return (
    <div className="bg-sand-50">
      <div className="container-main grid gap-8 py-8 md:grid-cols-2 md:py-12">
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-sand-300 bg-white">
            <Image src={images[activeImage]} alt={ar ? product.name_ar : product.name_en} fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            {product.badge_text && (
              <span className="absolute start-3 top-3 rounded-full bg-sun-500 px-3 py-1 text-xs font-semibold text-white shadow">{product.badge_text}</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button key={img + i} type="button" onClick={() => setActiveImage(i)} className={cn('relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2', activeImage === i ? 'border-sun-500' : 'border-transparent')}>
                  <Image src={img} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          )}

          {(ar ? product.description_ar : product.description_en) && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-sea-900/65">{ar ? product.description_ar : product.description_en}</p>
          )}

          {product.rental_requirements?.length > 0 && (
            <div className="mt-5 rounded-xl border border-sand-200 bg-white p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-sea-900"><ShieldCheck className="h-4 w-4 text-sea-600" />{commerce('requirements')}</p>
              <ul className="space-y-1 text-sm text-sea-900/65">
                {product.rental_requirements.map((req) => (
                  <li key={req}>• {REQUIREMENT_KEYS[req] ? commerce(REQUIREMENT_KEYS[req]) : req}</li>
                ))}
              </ul>
              {product.deposit_amount > 0 && (
                <p className="mt-2 text-sm font-semibold text-sea-900">{commerce('deposit')}: {Number(product.deposit_amount).toLocaleString()} {common('egp')}</p>
              )}
            </div>
          )}
        </div>

        <div>
          {product.commerce_categories && (
            <p className="text-xs font-semibold uppercase tracking-wider text-sea-900/40">{ar ? product.commerce_categories.name_ar : product.commerce_categories.name_en}</p>
          )}
          <h1 className="mt-2 font-display text-3xl font-extrabold text-sea-900">{ar ? product.name_ar : product.name_en}</h1>

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
                    className={cn('min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors', selected[option.id] === val.id ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 bg-white text-sea-900/70 hover:border-sea-400')}
                  >
                    {ar ? val.value_ar : val.value_en}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Start date */}
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-sea-900">{commerce('startDate')}</p>
            <input
              type="date"
              aria-label={commerce('startDate')}
              value={startDate}
              min={todayIso()}
              onChange={(e) => setStartDate(e.target.value < todayIso() ? todayIso() : e.target.value)}
              className="h-11 w-full max-w-[220px] rounded-lg border border-sand-300 bg-white px-3 text-sm text-sea-900 focus:border-sea-500 focus:outline-none"
              dir="ltr"
            />
          </div>

          {/* Duration tiers */}
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-sea-900">{commerce('duration')}</p>
            {tiers.length === 0 ? (
              <p className="text-xs text-sea-900/45">
                {hasOptions && !allOptionsSelected ? commerce('selectOptions') : commerce('noPricingConfigured')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tiers.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDurationDays(t.duration_days)}
                    aria-pressed={durationDays === t.duration_days}
                    className={cn('min-h-10 rounded-lg border px-4 text-sm font-medium transition-colors', durationDays === t.duration_days ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 bg-white text-sea-900/70 hover:border-sea-400')}
                  >
                    {ar ? (t.label_ar || `${t.duration_days} يوم`) : (t.label_en || `${t.duration_days}d`)}
                  </button>
                ))}
              </div>
            )}
            {endDate && (
              <p className="mt-2 text-xs text-sea-900/50">{commerce('returnsOn')}: <span dir="ltr" className="font-medium text-sea-900">{endDate}</span></p>
            )}
          </div>

          {/* Quantity */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm font-semibold text-sea-900">{commerce('quantity')}</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sand-300 hover:bg-sand-100">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-6 text-center font-bold tabular-nums">{quantity}</span>
              <button type="button" onClick={() => setQuantity((q) => q + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-sea-500 text-sea-700 hover:bg-sea-50">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {!availability.checking && !availability.available && (
            <p className="mt-3 text-xs font-semibold text-red-600">
              {availability.remaining != null ? commerce('unavailableDates', { count: availability.remaining }) : commerce('outOfStock')}
            </p>
          )}
          {!availability.checking && availability.available && availability.remaining != null && availability.remaining <= 3 && (
            <p className="mt-3 text-xs font-medium text-sun-600">{commerce('unitsLeft', { count: availability.remaining })}</p>
          )}

          {/* Fulfillment */}
          {(showPickup || showDelivery) && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-sea-900">{commerce('fulfillment')}</p>
              <div className="flex gap-2">
                {showPickup && (
                  <button type="button" onClick={() => setFulfillment('pickup')} className={cn('flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium', fulfillment === 'pickup' ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 bg-white text-sea-900/70')}>
                    <MapPin className="h-4 w-4" />{commerce('pickup')}
                  </button>
                )}
                {showDelivery && (
                  <button type="button" onClick={() => setFulfillment('delivery')} className={cn('flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium', fulfillment === 'delivery' ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 bg-white text-sea-900/70')}>
                    <Truck className="h-4 w-4" />{commerce('delivery')}
                  </button>
                )}
              </div>
              {fulfillment === 'delivery' && showDelivery && (
                <select aria-label={commerce('deliveryZone')} value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-sand-300 bg-white px-3 text-sm text-sea-900 focus:border-sea-500 focus:outline-none">
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {ar ? z.name_ar : z.name_en} {z.fee_type === 'fixed' ? `(+${z.fixed_fee} ${common('egp')})` : z.fee_type === 'free' ? `(${common('egp')} 0)` : `(${commerce('deliveryFeeConfirm')})`}
                    </option>
                  ))}
                </select>
              )}
              {fulfillment === 'pickup' && (product.pickup_instructions_ar || product.pickup_instructions_en) && (
                <p className="mt-2 text-xs text-sea-900/50">{ar ? product.pickup_instructions_ar : product.pickup_instructions_en}</p>
              )}
            </div>
          )}

          {/* Price summary */}
          {quote && (
            <div className="mt-6 space-y-1.5 rounded-xl border border-sand-200 bg-white p-4 text-sm">
              <div className="flex justify-between text-sea-900/60"><span>{commerce('itemSubtotal')}</span><span className="tabular-nums text-sea-900">{quote.subtotal.toLocaleString()} {common('egp')}</span></div>
              <div className="flex justify-between text-sea-900/60">
                <span>{commerce('deliveryFee')}</span>
                <span className="tabular-nums text-sea-900">
                  {fulfillment === 'pickup' ? '—' : deliveryFee?.fee_type === 'quote' ? commerce('deliveryFeeConfirm') : `${deliveryFeeAmount.toLocaleString()} ${common('egp')}`}
                </span>
              </div>
              <div className="flex justify-between border-t border-sand-200 pt-1.5 font-bold text-sea-900"><span>{commerce('estimatedTotal')}</span><span className="tabular-nums">{(quote.subtotal + deliveryFeeAmount).toLocaleString()} {common('egp')}</span></div>
            </div>
          )}

          <button
            type="button"
            onClick={addToCart}
            disabled={!canAdd}
            className={cn('mt-6 flex h-13 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-sand-300', justAdded ? 'bg-emerald-600' : 'bg-sun-500 hover:bg-sun-600')}
          >
            {justAdded ? <Check className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            {justAdded ? commerce('addedToCart') : commerce('addToCart')}
          </button>
        </div>
      </div>
    </div>
  )
}
