'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarDays, MessageCircle, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExperienceBookingForm } from './ExperienceBookingForm'
import {
  formatDateRange,
  formatPrice,
  isPastDate,
  type ExperienceDateWithAvailability,
} from '@/lib/experiences'

interface ExperienceDatesProps {
  dates: ExperienceDateWithAvailability[]
  experienceTitle: string
  price: number
  currency: string
  whatsappNumber: string
}

export function ExperienceDates({
  dates,
  experienceTitle,
  price,
  currency,
  whatsappNumber,
}: ExperienceDatesProps) {
  const t = useTranslations('experiences')
  const locale = useLocale()
  const ar = locale === 'ar'

  // Local availability overrides so a successful booking updates the list
  // without a full page refresh (the server value returns on next revalidate).
  const [remainingOverride, setRemainingOverride] = useState<Record<string, number>>({})
  const [openDateId, setOpenDateId] = useState<string | null>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!openDateId) return
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenDateId(null)
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [openDateId])

  const upcoming = dates.filter((d) => !isPastDate(d.end_date))
  if (!upcoming.length) {
    return (
      <div className="rounded-2xl border border-dashed border-sand-300 bg-white/70 p-8 text-center">
        <p className="text-sea-900/70">{t('noDatesYet')}</p>
        <a
          href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
            ar ? `عايز أعرف مواعيد تجربة: ${experienceTitle}` : `When is the next date for: ${experienceTitle}?`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-sea-700 px-5 text-sm font-semibold text-white hover:bg-sea-800"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" />
          {t('askOnWhatsApp')}
        </a>
      </div>
    )
  }

  const openDate = upcoming.find((d) => d.id === openDateId) ?? null

  return (
    <>
      <ul className="space-y-3">
        {upcoming.map((date) => {
          const remaining = remainingOverride[date.id] ?? date.spots_remaining
          const soldOut = remaining <= 0
          const cancelled = date.status === 'cancelled'
          const closed = !date.is_open
          const bookable = date.is_bookable && !soldOut
          const datePrice = date.price_override ?? price

          return (
            <li
              key={date.id}
              className={cn(
                'flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between',
                bookable ? 'border-sand-200 bg-white' : 'border-sand-200 bg-sand-100/70 opacity-80',
              )}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-display text-lg font-semibold text-sea-900">
                  <CalendarDays className="h-4 w-4 shrink-0 text-sea-500" aria-hidden="true" />
                  {formatDateRange(date.start_date, date.end_date, locale)}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-sea-900/70">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-sea-500" aria-hidden="true" />
                    {soldOut ? t('soldOut') : t('spotsLeft', { count: remaining })}
                  </span>
                  <span className="font-semibold text-sea-900">
                    {formatPrice(datePrice, currency, locale)}{' '}
                    <span className="font-normal text-sea-900/60">{t('perPersonInline')}</span>
                  </span>
                </p>
              </div>

              <div className="shrink-0">
                {cancelled ? (
                  <span className="inline-flex min-h-11 items-center rounded-full bg-sand-200 px-5 text-sm font-semibold text-sea-900/60">
                    {t('cancelled')}
                  </span>
                ) : soldOut || closed ? (
                  <a
                    href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                      ar
                        ? `عايز أنضم لقائمة الانتظار: ${experienceTitle} (${date.start_date})`
                        : `Waitlist request: ${experienceTitle} (${date.start_date})`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-sea-700 px-5 text-sm font-semibold text-sea-800 transition-colors hover:bg-sea-700 hover:text-white sm:w-auto"
                  >
                    {soldOut ? t('joinWaitlist') : t('bookingClosed')}
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenDateId(date.id)}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-sun-500 px-6 text-sm font-semibold text-white transition-colors hover:bg-sun-600 sm:w-auto"
                  >
                    {t('bookNow')}
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {openDate && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-sea-900/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="experience-booking-title"
        >
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="absolute inset-0 -z-10 h-full w-full cursor-default"
            onClick={() => setOpenDateId(null)}
          />
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-sand-50 p-6 shadow-2xl sm:rounded-3xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-sea-900/50">{experienceTitle}</p>
                <h2 id="experience-booking-title" className="font-display text-xl font-bold text-sea-900">
                  {t('requestBooking')}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpenDateId(null)}
                aria-label={t('close')}
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sea-900/60 transition-colors hover:bg-sand-200 hover:text-sea-900"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <ExperienceBookingForm
              date={{
                ...openDate,
                spots_remaining: remainingOverride[openDate.id] ?? openDate.spots_remaining,
              }}
              experienceTitle={experienceTitle}
              price={openDate.price_override ?? price}
              currency={currency}
              whatsappNumber={whatsappNumber}
              onBooked={(spotsRemaining) =>
                setRemainingOverride((prev) => ({ ...prev, [openDate.id]: spotsRemaining }))
              }
            />
          </div>
        </div>
      )}
    </>
  )
}
