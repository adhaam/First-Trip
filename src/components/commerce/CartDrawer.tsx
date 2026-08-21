'use client'

import Image from 'next/image'
import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { useCart } from './CartProvider'
import { Minus, Plus, Trash2, ShoppingBag, KeyRound } from 'lucide-react'

export function CartDrawer() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const cart = useCart()

  return (
    <Sheet open={cart.isOpen} onOpenChange={(open) => (open ? cart.open() : cart.close())}>
      <SheetContent
        side={ar ? 'left' : 'right'}
        closeLabel={ar ? 'إغلاق' : 'Close'}
        className="w-[calc(100vw-2rem)] border-sand-300 bg-sand-50 sm:w-[400px]"
      >
        <SheetTitle className="flex items-center gap-2 border-b border-sand-200 px-4 py-4 text-sea-900">
          <ShoppingBag className="h-5 w-5" />
          {ar ? 'سلة WEEMAP' : 'Your WEEMAP cart'}
        </SheetTitle>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <ShoppingBag className="h-10 w-10 text-sand-400" />
            <p className="text-sm font-medium text-sea-900">{ar ? 'السلة فاضية' : 'Your cart is empty'}</p>
            <p className="text-xs text-sea-900/50">
              {ar ? 'تصفح المتجر أو الإيجارات وابدأ الإضافة' : 'Browse Merch or Rentals to get started'}
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-2">
            {cart.items.map((item) => (
              <div key={item.lineId} className="flex gap-3 rounded-xl border border-sand-200 bg-white p-3">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sand-100">
                  {item.image && <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className={item.kind === 'rental'
                        ? 'mb-1 inline-flex items-center gap-1 rounded-full bg-sea-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sea-700'
                        : 'mb-1 inline-flex items-center gap-1 rounded-full bg-sun-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sun-700'}
                      >
                        {item.kind === 'rental' ? <KeyRound className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
                        {item.kind === 'rental' ? (ar ? 'إيجار' : 'Rent') : (ar ? 'شراء' : 'Buy')}
                      </span>
                      <p className="truncate text-sm font-semibold text-sea-900">{ar ? item.nameAr : item.nameEn}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.remove(item.lineId)}
                      aria-label={ar ? 'إزالة' : 'Remove'}
                      className="shrink-0 text-sea-900/40 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {(item.optionSummaryAr || item.optionSummaryEn) && (
                    <p className="mt-0.5 truncate text-[11px] text-sea-900/50">
                      {ar ? item.optionSummaryAr : item.optionSummaryEn}
                    </p>
                  )}
                  {item.kind === 'rental' && (
                    <p className="mt-0.5 text-[11px] text-sea-700">
                      {ar ? item.durationLabelAr || `${item.durationDays} يوم` : item.durationLabelEn || `${item.durationDays} day(s)`}
                      {' · '}
                      <span dir="ltr">{item.startDate} → {item.endDate}</span>
                    </p>
                  )}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => cart.setQuantity(item.lineId, item.quantity - 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-sand-300 text-sea-900 hover:bg-sand-100"
                        aria-label={ar ? 'إنقاص الكمية' : 'Decrease quantity'}
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="w-5 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => cart.setQuantity(item.lineId, item.quantity + 1)}
                        className="flex h-6 w-6 items-center justify-center rounded border border-sea-500 text-sea-700 hover:bg-sea-50"
                        aria-label={ar ? 'زيادة الكمية' : 'Increase quantity'}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-sea-900 tabular-nums">
                      {(item.unitPriceEstimate * item.quantity).toLocaleString()} {ar ? 'ج.م' : 'EGP'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {cart.items.length > 0 && (
          <div className="border-t border-sand-200 bg-white px-4 py-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-sea-900/60">{ar ? 'الإجمالي التقريبي' : 'Estimated subtotal'}</span>
              <span className="font-bold text-sea-900 tabular-nums">{cart.subtotal.toLocaleString()} {ar ? 'ج.م' : 'EGP'}</span>
            </div>
            <p className="mb-3 text-[11px] text-sea-900/45">
              {ar ? 'السعر النهائي والتوصيل يتأكدوا عند إرسال الطلب' : 'Final price and delivery are confirmed at checkout'}
            </p>
            <Link
              href="/cart"
              onClick={cart.close}
              className="flex h-12 w-full items-center justify-center rounded-full bg-sun-500 text-sm font-semibold text-white transition-colors hover:bg-sun-600"
            >
              {ar ? 'الذهاب للسلة' : 'Go to cart'}
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
