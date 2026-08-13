'use client'

import { useMemo, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import {
  PACKAGE_DEPARTURE_DAYS, PACKAGE_RETURN_DAYS,
  governoratesFor, quotePackage, quoteTransfer,
  upcomingDatesFor, formatEGP,
} from '@/lib/pricing'
import type {
  Accommodation, TransferDirection, TransferPricing, TransferType,
} from '@/lib/types'
import {
  Send, CheckCircle2, MessageCircle, Loader2, AlertCircle,
  Package, Bed, Bus, Calendar, Info,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── The one form to rule them all ───
// Adham's brief: no more separate /transfers page. Whether the user wants a
// full Dahab package, just the stay, or just the ride — same form. And packages
// have a fixed schedule (Sun/Thu out, Mon/Fri back), so we don't ask the user
// to pick dates for that mode — we just tell them the next departure.

type Mode = 'package' | 'stay-only' | 'transfer-only'

const schema = z.object({
  mode: z.enum(['package', 'stay-only', 'transfer-only']),

  // package
  duration: z.string().optional(),           // '4' | '5'
  package_governorate: z.string().optional(),
  package_direction: z.enum(['to_dahab', 'round_trip']).optional(),
  package_departure_date: z.string().optional(), // chosen departure date

  // stay-only
  nights: z.string().optional(),
  check_in_date: z.string().optional(),

  // transfer-only
  transfer_type: z.enum(['package_bus', 'hiace']).optional(),
  transfer_governorate: z.string().optional(),
  transfer_direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']).optional(),
  transfer_date: z.string().optional(),
  transfer_return_date: z.string().optional(),

  // shared
  num_people: z.string().min(1, 'Required'),
  full_name: z.string().min(3, 'Min 3 chars'),
  phone: z.string().min(10, 'Invalid phone'),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface Props {
  accommodation: Accommodation
  pricing: TransferPricing
  whatsapp?: string | null
}

export function BookingForm({ accommodation, pricing, whatsapp }: Props) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'package',
      num_people: '2',
      duration: '4',
      nights: '2',
      package_direction: 'round_trip',
      transfer_type: 'hiace',
      transfer_direction: 'round_trip',
    },
  })

  const mode = watch('mode') as Mode
  const duration = watch('duration') || '4'
  const packageGov = watch('package_governorate')
  const packageDirection = (watch('package_direction') ?? 'round_trip') as 'to_dahab' | 'round_trip'
  const packageDepartureDate = watch('package_departure_date')
  const nights = Math.max(1, parseInt(watch('nights') || '1') || 1)
  const transferType = (watch('transfer_type') ?? 'hiace') as TransferType
  const transferGov = watch('transfer_governorate')
  const transferDirection = (watch('transfer_direction') ?? 'round_trip') as TransferDirection
  const numPeople = Math.max(1, parseInt(watch('num_people') || '1') || 1)

  // ─── governorate options depend on which transfer type we're pricing ───
  const packageGovs = useMemo(() => governoratesFor(pricing, 'package_bus'), [pricing])
  const transferGovs = useMemo(
    () => governoratesFor(pricing, transferType),
    [pricing, transferType],
  )

  // ─── date options for standalone transfers ───
  // Bus: only Sun/Thu (out) or Mon/Fri (back). Hiace: any day.
  const busDepartureDates = useMemo(() => upcomingDatesFor(PACKAGE_DEPARTURE_DAYS, 10), [])
  const busReturnDates = useMemo(() => upcomingDatesFor(PACKAGE_RETURN_DAYS, 10), [])
  const anyDates = useMemo(() => upcomingDatesFor(null, 14), [])

  const transferDateOptions =
    transferType === 'package_bus'
      ? transferDirection === 'from_dahab' ? busReturnDates : busDepartureDates
      : anyDates

  const transferReturnDateOptions =
    transferType === 'package_bus' ? busReturnDates : anyDates

  // ─── upcoming departure dates for packages (user picks which one) ───
  // 4-day: departs Thu, returns Mon | 5-day: departs Sun, returns Fri
  const packageDepartureDates = useMemo(() => {
    const departDay = duration === '5' ? 0 : 4 // Sun(0) or Thu(4)
    return upcomingDatesFor([departDay], 8) // next 8 options
  }, [duration])

  const packageReturnDate = useMemo(() => {
    const returnDay = duration === '5' ? 5 : 1 // Fri(5) or Mon(1)
    const base = packageDepartureDate || packageDepartureDates[0]
    if (!base) return ''
    const [ret] = upcomingDatesFor([returnDay], 1, new Date(`${base}T00:00:00`))
    return ret
  }, [duration, packageDepartureDate, packageDepartureDates])

  // ─── live price preview (server recomputes on submit) ───
  const packageQuote = useMemo(() => {
    if (mode !== 'package') return null
    const accommodationPrice =
      duration === '5' ? Number(accommodation.price_5day) : Number(accommodation.price_4day)
    return quotePackage({
      pricing,
      accommodationPrice,
      governorateCode: packageGov,
      direction: packageDirection,
      numPeople,
    })
  }, [mode, duration, packageGov, packageDirection, numPeople, accommodation, pricing])

  const transferQuote = useMemo(() => {
    if (mode !== 'transfer-only') return null
    return quoteTransfer({
      pricing,
      type: transferType,
      governorateCode: transferGov,
      direction: transferDirection,
      numPeople,
    })
  }, [mode, transferType, transferGov, transferDirection, numPeople, pricing])

  const stayTotal =
    Number(accommodation.price_per_night) * nights * numPeople

  const total =
    mode === 'package'
      ? packageQuote?.total ?? 0
      : mode === 'transfer-only'
      ? transferQuote?.total ?? 0
      : stayTotal

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    return new Date(`${iso}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'short',
    })
  }

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    setServerError('')

    // Assemble the payload the /api/bookings route expects.
    const payload = (() => {
      if (data.mode === 'package') {
        return {
          customer_name: data.full_name,
          customer_phone: data.phone,
          booking_type: 'package' as const,
          accommodation_id: accommodation.id,
          governorate: data.package_governorate,
          trip_date: packageDepartureDate || packageDepartureDates[0],
          return_date: packageDirection === 'round_trip' ? packageReturnDate : undefined,
          duration: duration === '5' ? 5 : 4,
          transfer_type: 'package_bus' as const,
          transfer_direction: packageDirection,
          num_people: numPeople,
          notes: data.notes || undefined,
        }
      }
      if (data.mode === 'stay-only') {
        return {
          customer_name: data.full_name,
          customer_phone: data.phone,
          booking_type: 'accommodation-only' as const,
          accommodation_id: accommodation.id,
          trip_date: data.check_in_date || undefined,
          nights,
          num_people: numPeople,
          notes: data.notes || undefined,
        }
      }
      // transfer-only
      return {
        customer_name: data.full_name,
        customer_phone: data.phone,
        booking_type: 'transfer-only' as const,
        governorate: data.transfer_governorate,
        trip_date: data.transfer_date || undefined,
        return_date:
          transferDirection === 'round_trip' ? data.transfer_return_date : undefined,
        transfer_type: transferType,
        transfer_direction: transferDirection,
        num_people: numPeople,
        notes: data.notes || undefined,
      }
    })()

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(
          body.error ||
            (ar
              ? 'حصلت مشكلة في الإرسال. جرّب تاني أو كلمنا على واتساب.'
              : 'Something went wrong. Try again or WhatsApp us.'),
        )
        return
      }
      setSubmitted(true)
    } catch {
      setServerError(
        ar ? 'مفيش اتصال بالإنترنت. جرّب تاني.' : 'Network error. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappLink = () => {
    const accName = ar ? accommodation.name_ar : accommodation.name_en
    const modeLabel =
      mode === 'package' ? (ar ? 'باكدج' : 'Package') :
      mode === 'stay-only' ? (ar ? 'إقامة بس' : 'Stay only') :
      (ar ? 'انتقالات بس' : 'Transfer only')
    const text = encodeURIComponent(
      ar
        ? `عايز أحجز — ${accName}\nالنوع: ${modeLabel}\nعدد الأفراد: ${numPeople}\nالتكلفة التقريبية: ${formatEGP(total, 'en')} ج.م`
        : `Booking — ${accName}\nType: ${modeLabel}\nPeople: ${numPeople}\nEstimate: ${formatEGP(total, 'en')} EGP`,
    )
    return `https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${text}`
  }

  if (submitted) {
    return (
      <div className="rounded-3xl border-[1.5px] border-sea-100 bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-sea-900">
          {ar ? 'وصلنا طلبك!' : 'Your request is in!'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sea-900/60">
          {ar
            ? 'هنكلمك خلال ساعات قليلة نأكد الحجز ونظبط التفاصيل.'
            : 'We\'ll call you within a few hours to confirm and sort details.'}
        </p>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener"
          className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] font-semibold text-white transition-colors hover:bg-[#1FBE59]"
        >
          <MessageCircle className="h-4 w-4" />
          {ar ? 'كمّل على واتساب' : 'Continue on WhatsApp'}
        </a>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-3xl border-[1.5px] border-sea-100 bg-card shadow-sm">
      {/* ─── running total ─── */}
      <div className="border-b border-sea-100 bg-gradient-to-br from-sea-50 to-sun-50 p-6">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sea-900/50">
          {t('priceBreakdown')}
        </div>

        <div className="mt-3 space-y-1.5 text-sm">
          {mode === 'package' && packageQuote && (
            <>
              <Line
                label={`${t('accommodationLine')} · ${duration === '5' ? t('day5') : t('day4')}`}
                value={`${formatEGP(packageQuote.accommodationPerPerson, locale)} ${common('egp')}`}
              />
              <Line
                label={`${t('transferLine')} · ${
                  packageDirection === 'round_trip' ? t('roundTrip') : t('oneWay')
                }`}
                value={
                  packageQuote.transfer.isPriced
                    ? `${formatEGP(packageQuote.transfer.perPerson, locale)} ${common('egp')}`
                    : '—'
                }
              />
            </>
          )}
          {mode === 'stay-only' && (
            <Line
              label={`${t('accommodationLine')} · ${nights} ${
                nights === 1 ? common('night') : common('nights')
              }`}
              value={`${formatEGP(
                Number(accommodation.price_per_night) * nights,
                locale,
              )} ${common('egp')}`}
            />
          )}
          {mode === 'transfer-only' && transferQuote && (
            <Line
              label={`${transferType === 'package_bus'
                ? (ar ? 'باص جماعي' : 'Shared bus')
                : (ar ? 'هايس خاص' : 'Private Hiace')} · ${
                transferDirection === 'round_trip' ? t('roundTrip') : t('oneWay')
              }`}
              value={
                transferQuote.isPriced
                  ? `${formatEGP(transferQuote.perPerson, locale)} ${common('egp')}`
                  : '—'
              }
            />
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-sea-200/60 pt-4">
          <div className="text-xs text-sea-900/55">
            {t('totalFor')} {numPeople} {numPeople === 1 ? common('person') : common('people')}
          </div>
          <div className="font-display text-3xl font-bold text-sea-900">
            {formatEGP(total, locale)}{' '}
            <span className="text-base font-semibold text-sea-900/70">{common('egp')}</span>
          </div>
        </div>

        <p className="mt-2 text-[0.7rem] leading-relaxed text-sea-900/45">
          {ar ? '* السعر النهائي بيتأكد معاك قبل أي دفع.' : '* Final price confirmed before any payment.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 p-6">
        {/* ─── mode selector ─── */}
        <div>
          <Label className="mb-2.5 block">{t('bookingType')}</Label>
          <div className="grid gap-2">
            <ModeOption
              icon={Package}
              active={mode === 'package'}
              title={ar ? 'الباكدج الكامل' : 'Full package'}
              desc={ar ? 'انتقالات + إقامة + رحلتين' : 'Transfer + stay + 2 day trips'}
              onClick={() => setValue('mode', 'package')}
            />
            <ModeOption
              icon={Bed}
              active={mode === 'stay-only'}
              title={ar ? 'الإقامة بس' : 'Stay only'}
              desc={ar ? 'إقامة من غير انتقالات — إنت هتوصل بنفسك' : 'Just the stay — you\'ll get to Dahab on your own'}
              onClick={() => setValue('mode', 'stay-only')}
            />
            <ModeOption
              icon={Bus}
              active={mode === 'transfer-only'}
              title={ar ? 'الانتقالات بس' : 'Transfer only'}
              desc={ar ? 'باص جماعي أو هايس خاص — بدون إقامة' : 'Shared bus or private Hiace — no stay'}
              onClick={() => setValue('mode', 'transfer-only')}
            />
          </div>
        </div>

        {/* ─── PACKAGE MODE ─── */}
        {mode === 'package' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">{t('duration')}</Label>
                <Select
                  value={duration}
                  onValueChange={(v) => v && setValue('duration', v)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">{t('day4')}</SelectItem>
                    <SelectItem value="5">{t('day5')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1.5 block">{t('governorate')}</Label>
                <Select
                  value={packageGov}
                  onValueChange={(v) => v && setValue('package_governorate', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {packageGovs.map((g) => (
                      <SelectItem key={g.id} value={g.governorate_code}>
                        {ar ? g.name_ar : g.name_en}
                        {g.price_surcharge > 0 ? ` (+${g.price_surcharge})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="mb-1.5 block">{t('transferDirection')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['round_trip', 'to_dahab'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue('package_direction', d)}
                    className={cn(
                      'rounded-2xl border-[1.5px] px-3 py-2.5 text-sm font-medium transition-colors',
                      packageDirection === d
                        ? 'border-sea-500 bg-sea-50 text-sea-700'
                        : 'border-sea-100 text-sea-900/65 hover:border-sea-300',
                    )}
                  >
                    {d === 'round_trip' ? t('roundTrip') : t('oneWay')}
                  </button>
                ))}
              </div>
            </div>

            {/* Departure date selector */}
            <div>
              <Label className="mb-1.5 block">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-sea-500" />
                  {ar ? 'تاريخ القيام' : 'Departure date'}
                </span>
              </Label>
              <Select
                value={packageDepartureDate || packageDepartureDates[0] || ''}
                onValueChange={(v) => v && setValue('package_departure_date', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={ar ? 'اختر تاريخ' : 'Choose date'} />
                </SelectTrigger>
                <SelectContent>
                  {packageDepartureDates.map((d) => (
                    <SelectItem key={d} value={d}>
                      {new Date(`${d}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {packageReturnDate && packageDirection === 'round_trip' && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-sea-900/60">
                  <Info className="h-3.5 w-3.5 shrink-0 text-sun-500" />
                  {ar ? 'الرجوع:' : 'Return:'}{' '}
                  <span className="font-semibold text-sea-900">
                    {new Date(`${packageReturnDate}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* ─── STAY-ONLY MODE ─── */}
        {mode === 'stay-only' && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">{t('nights')}</Label>
                <Select
                  value={String(nights)}
                  onValueChange={(v) => v && setValue('nights', v)}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7, 10, 14].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n} {n === 1 ? common('night') : common('nights')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block">{t('travelDate')}</Label>
                <Input
                  type="date"
                  {...register('check_in_date')}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
          </>
        )}

        {/* ─── TRANSFER-ONLY MODE ─── */}
        {mode === 'transfer-only' && (
          <>
            {/* type: bus vs hiace */}
            <div>
              <Label className="mb-2 block">{ar ? 'نوع الانتقال' : 'Transfer type'}</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                <TransferTypeCard
                  active={transferType === 'hiace'}
                  title={t('transferTypeHiace')}
                  desc={t('transferTypeHiaceDesc')}
                  onClick={() => setValue('transfer_type', 'hiace')}
                />
                <TransferTypeCard
                  active={transferType === 'package_bus'}
                  title={t('transferTypeBus')}
                  desc={t('transferTypeBusDesc')}
                  onClick={() => setValue('transfer_type', 'package_bus')}
                />
              </div>
            </div>

            {/* direction */}
            <div>
              <Label className="mb-1.5 block">{t('transferDirection')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['round_trip', 'to_dahab', 'from_dahab'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue('transfer_direction', d)}
                    className={cn(
                      'rounded-2xl border-[1.5px] px-2 py-2.5 text-xs font-medium transition-colors sm:text-sm',
                      transferDirection === d
                        ? 'border-sea-500 bg-sea-50 text-sea-700'
                        : 'border-sea-100 text-sea-900/65 hover:border-sea-300',
                    )}
                  >
                    {d === 'round_trip'
                      ? t('roundTrip')
                      : d === 'to_dahab'
                      ? (ar ? 'لدهب' : 'To Dahab')
                      : (ar ? 'من دهب' : 'From Dahab')}
                  </button>
                ))}
              </div>
            </div>

            {/* governorate */}
            <div>
              <Label className="mb-1.5 block">{t('governorate')}</Label>
              <Select
                value={transferGov}
                onValueChange={(v) => v && setValue('transfer_governorate', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectGovernorate')} />
                </SelectTrigger>
                <SelectContent>
                  {transferGovs.map((g) => (
                    <SelectItem key={g.id} value={g.governorate_code}>
                      {ar ? g.name_ar : g.name_en}
                      {g.price_surcharge > 0 ? ` (+${g.price_surcharge})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* dates */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 block">
                  {transferDirection === 'from_dahab'
                    ? (ar ? 'تاريخ العودة' : 'Return date')
                    : (ar ? 'تاريخ الذهاب' : 'Departure date')}
                </Label>
                {transferType === 'package_bus' ? (
                  <Select
                    value={watch('transfer_date') ?? ''}
                    onValueChange={(v) => v && setValue('transfer_date', v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectDate')} />
                    </SelectTrigger>
                    <SelectContent>
                      {transferDateOptions.map((d) => (
                        <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    type="date"
                    {...register('transfer_date')}
                    min={new Date().toISOString().split('T')[0]}
                  />
                )}
                {transferType === 'package_bus' && (
                  <p className="mt-1.5 text-xs text-sea-900/45">
                    {transferDirection === 'from_dahab' ? t('returnDaysNote') : t('departureDaysNote')}
                  </p>
                )}
              </div>

              {transferDirection === 'round_trip' && (
                <div>
                  <Label className="mb-1.5 block">{t('returnDate')}</Label>
                  {transferType === 'package_bus' ? (
                    <Select
                      value={watch('transfer_return_date') ?? ''}
                      onValueChange={(v) => v && setValue('transfer_return_date', v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t('selectDate')} />
                      </SelectTrigger>
                      <SelectContent>
                        {transferReturnDateOptions.map((d) => (
                          <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      type="date"
                      {...register('transfer_return_date')}
                      min={new Date().toISOString().split('T')[0]}
                    />
                  )}
                </div>
              )}
            </div>

            {mode === 'transfer-only' && (
              <div className="flex items-start gap-3 rounded-2xl border border-sea-100 bg-sea-50/40 p-4 text-xs leading-relaxed text-sea-900/70">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sea-500" />
                <span>
                  {ar
                    ? 'الحجز ده للانتقالات فقط — من غير إقامة. المكان اللي إنت بتشوفه فوق مش هيتحسب في السعر.'
                    : 'This is a transfer-only booking — no stay included. The listing above is not included in the price.'}
                </span>
              </div>
            )}
          </>
        )}

        {/* ─── shared fields ─── */}
        <div>
          <Label className="mb-1.5 block">{t('numPeople')}</Label>
          <Input type="number" min="1" max="50" inputMode="numeric" {...register('num_people')} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">{t('fullName')}</Label>
            <Input {...register('full_name')} aria-invalid={Boolean(errors.full_name)} />
            {errors.full_name && (
              <p className="mt-1 text-xs text-red-600">{errors.full_name.message}</p>
            )}
          </div>
          <div>
            <Label className="mb-1.5 block">{t('phoneNumber')}</Label>
            <Input
              type="tel"
              dir="ltr"
              inputMode="tel"
              {...register('phone')}
              aria-invalid={Boolean(errors.phone)}
            />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{errors.phone.message}</p>}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">{t('notes')}</Label>
          <Textarea rows={3} placeholder={t('notesPlaceholder')} {...register('notes')} />
        </div>

        {serverError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          <Button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-full bg-gradient-to-r from-sun-500 to-sun-400 text-base font-semibold text-white shadow-sm transition-all hover:from-sun-600 hover:to-sun-500 hover:shadow-md"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('submit')}
          </Button>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[#25D366] font-semibold text-[#128C4A] transition-colors hover:bg-[#25D366]/10"
          >
            <MessageCircle className="h-4 w-4" />
            {t('whatsappBooking')}
          </a>
        </div>
      </form>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sea-900/60">{label}</span>
      <span className="font-medium text-sea-900">{value}</span>
    </div>
  )
}

function ModeOption({
  icon: Icon, active, title, desc, onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-2xl border-[1.5px] p-4 text-start transition-colors',
        active
          ? 'border-sea-500 bg-sea-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-sea-500 text-white' : 'bg-sea-50 text-sea-600',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-sea-900">{title}</span>
        <span className="mt-0.5 block text-xs text-sea-900/55">{desc}</span>
      </span>
    </button>
  )
}

function TransferTypeCard({
  active, title, desc, onClick,
}: {
  active: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-2xl border-[1.5px] p-3 text-start transition-colors',
        active
          ? 'border-sea-500 bg-sea-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <div className="text-sm font-semibold text-sea-900">{title}</div>
      <div className="mt-1 text-xs leading-snug text-sea-900/60">{desc}</div>
    </button>
  )
}
