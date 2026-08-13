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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import {
  PACKAGE_DEPARTURE_DAYS, PACKAGE_RETURN_DAYS,
  governoratesFor, quotePackage, upcomingDatesFor, formatEGP,
} from '@/lib/pricing'
import type { Accommodation, TransferDirection, TransferPricing } from '@/lib/types'
import { Send, CheckCircle2, MessageCircle, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  booking_type: z.enum(['package', 'accommodation-only']),
  nights: z.string().optional(),
  duration: z.string().optional(),
  governorate: z.string().optional(),
  transfer_direction: z.enum(['to_dahab', 'round_trip']).optional(),
  travel_date: z.string().optional(),
  return_date: z.string().optional(),
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
      booking_type: 'package',
      num_people: '2',
      duration: '4',
      nights: '1',
      transfer_direction: 'round_trip',
    },
  })

  const bookingType = watch('booking_type')
  const duration = watch('duration')
  const governorate = watch('governorate')
  const direction = (watch('transfer_direction') ?? 'round_trip') as TransferDirection
  const numPeople = Math.max(1, parseInt(watch('num_people') || '1') || 1)
  const nights = Math.max(1, parseInt(watch('nights') || '1') || 1)

  const govOptions = useMemo(() => governoratesFor(pricing, 'package_bus'), [pricing])
  const departureDates = useMemo(() => upcomingDatesFor(PACKAGE_DEPARTURE_DAYS, 14), [])
  const returnDates = useMemo(() => upcomingDatesFor(PACKAGE_RETURN_DAYS, 14), [])

  // ─── live price preview (the server recomputes this on submit) ───
  const quote = useMemo(() => {
    if (bookingType === 'accommodation-only') return null
    const accommodationPrice =
      duration === '5' ? Number(accommodation.price_5day) : Number(accommodation.price_4day)
    return quotePackage({
      pricing,
      accommodationPrice,
      governorateCode: governorate,
      direction,
      numPeople,
    })
  }, [bookingType, duration, governorate, direction, numPeople, accommodation, pricing])

  const accommodationOnlyTotal =
    Number(accommodation.price_per_night) * nights * numPeople

  const total = bookingType === 'package' ? quote?.total ?? 0 : accommodationOnlyTotal

  const formatDate = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'short',
    })

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    setServerError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // NOTE: these key names must match the zod schema in /api/bookings —
          // they used to be full_name/phone/travel_date, which silently 400'd.
          customer_name: data.full_name,
          customer_phone: data.phone,
          booking_type: data.booking_type,
          accommodation_id: accommodation.id,
          governorate: data.booking_type === 'package' ? data.governorate : undefined,
          trip_date: data.travel_date || undefined,
          return_date:
            data.booking_type === 'package' && direction === 'round_trip'
              ? data.return_date || undefined
              : undefined,
          duration:
            data.booking_type === 'package' ? (duration === '5' ? 5 : 4) : undefined,
          nights: data.booking_type === 'accommodation-only' ? nights : undefined,
          transfer_type: data.booking_type === 'package' ? 'package_bus' : undefined,
          transfer_direction: data.booking_type === 'package' ? direction : undefined,
          num_people: numPeople,
          notes: data.notes || undefined,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(
          body.error ||
            (ar ? 'حصلت مشكلة في إرسال الحجز. جرّب تاني أو كلمنا على واتساب.'
                : 'Something went wrong. Please try again or message us on WhatsApp.'),
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
    const text = encodeURIComponent(
      ar
        ? `حجز جديد — ${accName}\nالنوع: ${bookingType === 'package' ? 'باكدج' : 'إقامة فقط'}\nعدد الأفراد: ${numPeople}\nالتكلفة التقريبية: ${formatEGP(total, 'en')} ج.م`
        : `New booking — ${accName}\nType: ${bookingType}\nPeople: ${numPeople}\nEstimate: ${formatEGP(total, 'en')} EGP`,
    )
    return `https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${text}`
  }

  if (submitted) {
    return (
      <div className="border-[1.5px] border-sea-900/15 bg-white p-8 text-center pin-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-sea-900">
          {ar ? 'وصلنا طلبك!' : 'Your request is in!'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sea-900/60">
          {ar
            ? 'هنكلمك خلال ساعات قليلة لتأكيد الحجز وتفاصيل الدفع.'
            : 'We\'ll call you within a few hours to confirm and sort out payment.'}
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
    <div className="border-[1.5px] border-sand-300 bg-white pin-card">
      {/* ─── running total ─── */}
      <div className="border-b border-sand-300 bg-sand-100 p-6">
        <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sea-900/50">
          {t('priceBreakdown')}
        </div>

        <div className="mt-3 space-y-1.5 text-sm">
          {bookingType === 'package' && quote ? (
            <>
              <Line
                label={`${t('accommodationLine')} · ${duration === '5' ? t('day5') : t('day4')}`}
                value={`${formatEGP(quote.accommodationPerPerson, locale)} ${common('egp')}`}
              />
              <Line
                label={`${t('transferLine')} · ${
                  direction === 'round_trip' ? t('roundTrip') : t('oneWay')
                }`}
                value={
                  quote.transfer.isPriced
                    ? `${formatEGP(quote.transfer.perPerson, locale)} ${common('egp')}`
                    : '—'
                }
              />
            </>
          ) : (
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
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-sand-300 pt-4">
          <div className="text-xs text-sea-900/55">
            {t('totalFor')} {numPeople} {numPeople === 1 ? common('person') : common('people')}
          </div>
          <div className="font-display text-3xl font-extrabold text-sea-900">
            {formatEGP(total, locale)}{' '}
            <span className="text-base font-semibold text-sea-900/70">{common('egp')}</span>
          </div>
        </div>

        <p className="mt-2 text-[0.7rem] leading-relaxed text-sea-900/45">
          {ar ? '* السعر النهائي بيتأكد معاك قبل أي دفع.' : '* Final price confirmed before any payment.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 p-6">
        {/* booking type */}
        <div>
          <Label className="mb-2.5 block">{t('bookingType')}</Label>
          <RadioGroup
            value={bookingType}
            onValueChange={(v) => setValue('booking_type', v as FormData['booking_type'])}
            className="grid gap-2"
          >
            <TypeOption
              value="package"
              id="bt-package"
              active={bookingType === 'package'}
              title={ar ? 'باكدج كامل' : 'Full package'}
              desc={ar ? 'انتقالات + إقامة + رحلتين داخليتين' : 'Transfer + stay + 2 day trips'}
            />
            <TypeOption
              value="accommodation-only"
              id="bt-acc"
              active={bookingType === 'accommodation-only'}
              title={t('accommodationOnly')}
              desc={ar ? 'الإقامة بس، من غير انتقالات' : 'Just the stay, no transfer'}
            />
          </RadioGroup>
        </div>

        {bookingType === 'package' && (
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
                  value={governorate}
                  onValueChange={(v) => v && setValue('governorate', v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {govOptions.map((g) => (
                      <SelectItem key={g.id} value={g.governorate_code}>
                        {ar ? g.name_ar : g.name_en}
                        {g.price_surcharge > 0 ? ` (+${g.price_surcharge})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* transfer direction */}
            <div>
              <Label className="mb-1.5 block">{t('transferDirection')}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(['round_trip', 'to_dahab'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setValue('transfer_direction', d)}
                    className={cn(
                      'rounded-xl border-[1.5px] px-3 py-2.5 text-sm font-medium transition-colors',
                      direction === d
                        ? 'border-sea-600 bg-sea-50 text-sea-700'
                        : 'border-sand-300 text-sea-900/65 hover:border-sea-900/25',
                    )}
                  >
                    {d === 'round_trip' ? t('roundTrip') : t('oneWay')}
                  </button>
                ))}
              </div>
            </div>

            {/* departure — Sunday / Thursday only */}
            <div>
              <Label className="mb-1.5 block">{t('travelDate')}</Label>
              <Select
                value={watch('travel_date') ?? ''}
                onValueChange={(v) => { if (v) setValue('travel_date', v) }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('selectDate')} />
                </SelectTrigger>
                <SelectContent>
                  {departureDates.map((d) => (
                    <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-xs text-sea-900/45">{t('departureDaysNote')}</p>
            </div>

            {/* return — Monday / Friday only */}
            {direction === 'round_trip' && (
              <div>
                <Label className="mb-1.5 block">{t('returnDate')}</Label>
                <Select
                  value={watch('return_date') ?? ''}
                  onValueChange={(v) => { if (v) setValue('return_date', v) }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectDate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {returnDates.map((d) => (
                      <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-sea-900/45">{t('returnDaysNote')}</p>
              </div>
            )}
          </>
        )}

        {bookingType === 'accommodation-only' && (
          <>
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
                {...register('travel_date')}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          </>
        )}

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
            className="h-12 w-full rounded-full bg-sun-400 text-base font-semibold text-white hover:bg-sun-500"
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

function TypeOption({
  value, id, active, title, desc,
}: {
  value: string
  id: string
  active: boolean
  title: string
  desc: string
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] p-3.5 font-normal transition-colors',
        active ? 'border-sea-600 bg-sea-50' : 'border-sand-300 hover:border-sea-900/25',
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <span>
        <span className="block text-sm font-semibold text-sea-900">{title}</span>
        <span className="mt-0.5 block text-xs text-sea-900/55">{desc}</span>
      </span>
    </Label>
  )
}
