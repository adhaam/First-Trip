'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Minus, Plus, Trash2, ShoppingBag, KeyRound, MessageCircle, PartyPopper, MapPin, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from './CartProvider'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import type { DeliveryZone } from '@/lib/commerce-types'

export function CartCheckoutClient({ deliveryZones, whatsapp }: { deliveryZones: DeliveryZone[]; whatsapp?: string | null }) {
  const locale = useLocale()
  const ar = locale === 'ar'
  const commerce = useTranslations('commerce')
  const common = useTranslations('common')
  const cart = useCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState(cart.deliveryAddress)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ orderNumber: string; totalPrice: number } | null>(null)

  const zone = deliveryZones.find((z) => z.id === cart.deliveryZoneId)
  const deliveryFee = cart.fulfillmentMethod === 'delivery' ? (zone?.fee_type === 'fixed' ? Number(zone.fixed_fee) : 0) : 0
  const total = cart.subtotal + deliveryFee
  const number = (whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')

  const submit = async () => {
    setError('')
    if (name.trim().length < 3) { setError(commerce('nameRequired')); return }
    if (phone.trim().length < 8) { setError(commerce('phoneRequired')); return }
    if (cart.fulfillmentMethod === 'delivery') {
      if (deliveryZones.length > 0 && !cart.deliveryZoneId) { setError(commerce('zoneRequired')); return }
      if (!address.trim()) { setError(commerce('addressRequired')); return }
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/commerce/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_email: email.trim() || undefined,
          fulfillment_method: cart.fulfillmentMethod,
          delivery_zone_id: cart.fulfillmentMethod === 'delivery' ? cart.deliveryZoneId || undefined : undefined,
          delivery_address: cart.fulfillmentMethod === 'delivery' ? address.trim() : undefined,
          notes: notes.trim() || undefined,
          items: cart.items.map((item) => ({
            product_id: item.productId,
            variant_id: item.variantId || undefined,
            quantity: item.quantity,
            ...(item.kind === 'rental'
              ? { rental_duration_days: item.durationDays, rental_start_date: item.startDate }
              : {}),
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || commerce('checkoutError'))
        return
      }
      setSuccess({ orderNumber: data.orderNumber, totalPrice: data.totalPrice })
      cart.clear()
    } catch {
      setError(commerce('checkoutError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    const waMessage = ar
      ? `مرحباً WEEMAP، لسه بعتّ طلب ${success.orderNumber}`
      : `Hi WEEMAP, I just sent request ${success.orderNumber}`
    return (
      <div className="container-main flex min-h-[60svh] flex-col items-center justify-center py-16 text-center">
        <PartyPopper className="mb-4 h-12 w-12 text-sun-500" />
        <h1 className="font-display text-2xl font-extrabold text-sea-900">{commerce('requestSentTitle')}</h1>
        <p className="mt-2 max-w-sm text-sm text-sea-900/60">{commerce('requestSentText')}</p>
        <div className="mt-6 rounded-xl border border-sand-200 bg-white px-6 py-4">
          <p className="text-xs text-sea-900/45">{commerce('orderReference')}</p>
          <p className="font-mono text-lg font-bold text-sea-900" dir="ltr">{success.orderNumber}</p>
          <p className="mt-1 text-sm text-sea-900/60">{total.toLocaleString()} {common('egp')} <span className="text-xs">({commerce('estimate')})</span></p>
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={`https://wa.me/${number}?text=${encodeURIComponent(waMessage)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <MessageCircle className="h-4 w-4" />
            {commerce('whatsappCta')}
          </a>
          <Link href="/merch" className="inline-flex h-12 items-center justify-center rounded-full border border-sand-300 px-6 text-sm font-semibold text-sea-900 hover:bg-sand-100">
            {commerce('continueShopping')}
          </Link>
        </div>
      </div>
    )
  }

  if (cart.hydrated && cart.items.length === 0) {
    return (
      <div className="container-main flex min-h-[60svh] flex-col items-center justify-center py-16 text-center">
        <ShoppingBag className="mb-4 h-10 w-10 text-sand-400" />
        <h1 className="font-display text-xl font-bold text-sea-900">{commerce('cartEmpty')}</h1>
        <p className="mt-1 text-sm text-sea-900/50">{commerce('cartEmptyText')}</p>
        <div className="mt-6 flex gap-3">
          <Link href="/merch" className="inline-flex h-11 items-center justify-center rounded-full bg-sun-500 px-5 text-sm font-semibold text-white hover:bg-sun-600">{commerce('browseMerch')}</Link>
          <Link href="/rent" className="inline-flex h-11 items-center justify-center rounded-full border border-sand-300 px-5 text-sm font-semibold text-sea-900 hover:bg-sand-100">{commerce('browseRentals')}</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="container-main grid gap-8 py-8 md:grid-cols-[1.3fr_1fr] md:py-12">
      <div>
        <h1 className="mb-5 font-display text-2xl font-extrabold text-sea-900">{commerce('cartTitle')}</h1>
        <div className="space-y-3">
          {cart.items.map((item) => (
            <div key={item.lineId} className="flex gap-3 rounded-xl border border-sand-200 bg-white p-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                {item.image && <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={item.kind === 'rental'
                      ? 'mb-1 inline-flex items-center gap-1 rounded-full bg-sea-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sea-700'
                      : 'mb-1 inline-flex items-center gap-1 rounded-full bg-sun-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sun-700'}
                    >
                      {item.kind === 'rental' ? <KeyRound className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                      {item.kind === 'rental' ? (ar ? 'إيجار' : 'Rent') : (ar ? 'شراء' : 'Buy')}
                    </span>
                    <p className="text-sm font-semibold text-sea-900">{ar ? item.nameAr : item.nameEn}</p>
                    {(item.optionSummaryAr || item.optionSummaryEn) && (
                      <p className="text-xs text-sea-900/50">{ar ? item.optionSummaryAr : item.optionSummaryEn}</p>
                    )}
                    {item.kind === 'rental' && (
                      <p className="mt-0.5 text-xs text-sea-700">
                        {ar ? item.durationLabelAr || `${item.durationDays} يوم` : item.durationLabelEn || `${item.durationDays}d`} · <span dir="ltr">{item.startDate} → {item.endDate}</span>
                      </p>
                    )}
                  </div>
                  <button type="button" onClick={() => cart.remove(item.lineId)} className="shrink-0 text-sea-900/40 hover:text-red-500" aria-label={commerce('remove')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => cart.setQuantity(item.lineId, item.quantity - 1)} className="flex h-7 w-7 items-center justify-center rounded border border-sand-300 hover:bg-sand-100"><Minus className="h-3 w-3" /></button>
                    <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                    <button type="button" onClick={() => cart.setQuantity(item.lineId, item.quantity + 1)} className="flex h-7 w-7 items-center justify-center rounded border border-sea-500 text-sea-700 hover:bg-sea-50"><Plus className="h-3 w-3" /></button>
                  </div>
                  <span className="text-sm font-bold text-sea-900 tabular-nums">{(item.unitPriceEstimate * item.quantity).toLocaleString()} {common('egp')}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checkout panel */}
      <div className="h-fit rounded-2xl border border-sand-200 bg-white p-5">
        <h2 className="font-display text-lg font-bold text-sea-900">{commerce('checkoutTitle')}</h2>
        <p className="mt-1 text-xs text-sea-900/50">{commerce('checkoutSubtitle')}</p>

        {/* Fulfillment */}
        <div className="mt-4">
          <div className="flex gap-2">
            <button type="button" onClick={() => cart.setFulfillmentMethod('pickup')} className={cn('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium', cart.fulfillmentMethod === 'pickup' ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 text-sea-900/70')}>
              <MapPin className="h-4 w-4" />{commerce('pickup')}
            </button>
            <button type="button" onClick={() => cart.setFulfillmentMethod('delivery')} className={cn('flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium', cart.fulfillmentMethod === 'delivery' ? 'border-sun-500 bg-sun-500 text-white' : 'border-sand-300 text-sea-900/70')}>
              <Truck className="h-4 w-4" />{commerce('delivery')}
            </button>
          </div>
          {cart.fulfillmentMethod === 'delivery' && (
            <div className="mt-3 space-y-3">
              {deliveryZones.length > 0 && (
                <select aria-label={commerce('deliveryZone')} value={cart.deliveryZoneId || ''} onChange={(e) => cart.setDeliveryZoneId(e.target.value || null)} className="h-11 w-full rounded-lg border border-sand-300 px-3 text-sm focus:border-sea-500 focus:outline-none">
                  <option value="">{commerce('selectZone')}</option>
                  {deliveryZones.map((z) => (
                    <option key={z.id} value={z.id}>{ar ? z.name_ar : z.name_en} {z.fee_type === 'fixed' ? `(+${z.fixed_fee} ${common('egp')})` : z.fee_type === 'free' ? `(${common('egp')} 0)` : `(${commerce('deliveryFeeConfirm')})`}</option>
                  ))}
                </select>
              )}
              <textarea aria-label={commerce('deliveryAddress')} value={address} onChange={(e) => { setAddress(e.target.value); cart.setDeliveryAddress(e.target.value) }} placeholder={commerce('deliveryAddress')} rows={2} className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm focus:border-sea-500 focus:outline-none" />
            </div>
          )}
        </div>

        {/* Guest details */}
        <div className="mt-4 space-y-3">
          <input aria-label={commerce('fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={commerce('fullName')} className="h-11 w-full rounded-lg border border-sand-300 px-3 text-sm focus:border-sea-500 focus:outline-none" />
          <input aria-label={commerce('phoneNumber')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={commerce('phoneNumber')} dir="ltr" inputMode="tel" className="h-11 w-full rounded-lg border border-sand-300 px-3 text-sm focus:border-sea-500 focus:outline-none" />
          <input aria-label={commerce('email')} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`${commerce('email')} (${commerce('optional')})`} dir="ltr" inputMode="email" className="h-11 w-full rounded-lg border border-sand-300 px-3 text-sm focus:border-sea-500 focus:outline-none" />
          <textarea aria-label={commerce('notes')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={commerce('notesPlaceholder')} rows={2} className="w-full rounded-lg border border-sand-300 px-3 py-2 text-sm focus:border-sea-500 focus:outline-none" />
        </div>

        {/* Totals */}
        <div className="mt-4 space-y-1.5 border-t border-sand-200 pt-4 text-sm">
          <div className="flex justify-between text-sea-900/60"><span>{commerce('subtotal')}</span><span className="tabular-nums text-sea-900">{cart.subtotal.toLocaleString()} {common('egp')}</span></div>
          <div className="flex justify-between text-sea-900/60">
            <span>{commerce('deliveryFee')}</span>
            <span className="tabular-nums text-sea-900">{cart.fulfillmentMethod === 'pickup' ? '—' : zone?.fee_type === 'quote' ? commerce('deliveryFeeConfirm') : `${deliveryFee.toLocaleString()} ${common('egp')}`}</span>
          </div>
          <div className="flex justify-between border-t border-sand-200 pt-1.5 font-bold text-sea-900"><span>{commerce('total')}</span><span className="tabular-nums">{total.toLocaleString()} {common('egp')}</span></div>
        </div>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || cart.items.length === 0}
          className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-500 text-sm font-semibold text-white transition-colors hover:bg-sun-600 disabled:opacity-50"
        >
          {submitting ? commerce('submitting') : commerce('submitRequest')}
        </button>
      </div>
    </div>
  )
}
