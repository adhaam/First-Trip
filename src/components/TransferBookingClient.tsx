'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { Reveal } from '@/components/motion/Reveal'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { governoratesFor, quoteTransfer, formatEGP } from '@/lib/pricing'
import type { TransferDirection, TransferPricing } from '@/lib/types'
import {
  Send, CheckCircle2, MessageCircle, Loader2, AlertCircle, ArrowRightLeft, ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const schema = z.object({
  direction: z.enum(['to_dahab', 'from_dahab', 'round_trip']),
  governorate: z.string().min(1),
  depart_date: z.string().min(1),
  return_date: z.string().optional(),
  num_people: z.string().min(1),
  full_name: z.string().min(3),
  phone: z.string().min(10),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const DIRECTIONS: { value: TransferDirection; icon: typeof ArrowRight }[] = [
  { value: 'to_dahab', icon: ArrowRight },
  { value: 'from_dahab', icon: ArrowRight },
  { value: 'round_trip', icon: ArrowRightLeft },
]

export function TransferBookingClient({
  pricing,
  whatsapp,
}: {
  pricing: TransferPricing
  whatsapp?: string | null
}) {
  const t = useTranslations('transfer')
  const bookT = useTranslations('book')
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
    defaultValues: { direction: 'round_trip', num_people: '1' },
  })

  const direction = watch('direction')
  const governorate = watch('governorate')
  const numPeople = Math.max(1, parseInt(watch('num_people') || '1') || 1)

  const govOptions = useMemo(() => governoratesFor(pricing, 'hiace'), [pricing])

  const quote = useMemo(
    () => quoteTransfer({ pricing, type: 'hiace', governorateCode: governorate, direction, numPeople }),
    [pricing, governorate, direction, numPeople],
  )

  const today = new Date().toISOString().split('T')[0]

  const onSubmit = async (data: FormData) => {
    setSubmitting(true)
    setServerError('')
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: data.full_name,
          customer_phone: data.phone,
          booking_type: 'transfer-only',
          governorate: data.governorate,
          trip_date: data.depart_date,
          return_date: data.direction === 'round_trip' ? data.return_date || undefined : undefined,
          transfer_type: 'hiace',
          transfer_direction: data.direction,
          num_people: numPeople,
          notes: data.notes || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(
          body.error ||
            (ar ? 'حصلت مشكلة في إرسال الطلب. جرّب تاني أو كلمنا على واتساب.'
                : 'Something went wrong. Please try again or message us on WhatsApp.'),
        )
        return
      }
      setSubmitted(true)
    } catch {
      setServerError(ar ? 'مفيش اتصال بالإنترنت.' : 'Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const whatsappLink = () => {
    const text = encodeURIComponent(
      ar
        ? `حجز انتقالات (هاي إيس)\nالاتجاه: ${direction}\nعدد الأفراد: ${numPeople}\nالتكلفة التقريبية: ${formatEGP(quote.total, 'en')} ج.م`
        : `Hiace transfer request\nDirection: ${direction}\nPeople: ${numPeople}\nEstimate: ${formatEGP(quote.total, 'en')} EGP`,
    )
    return `https://wa.me/${(whatsapp || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')}?text=${text}`
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg border-[1.5px] border-sea-900/15 bg-white p-8 text-center pin-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-sea-900">
          {ar ? 'وصلنا طلبك!' : 'Your request is in!'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-sea-900/60">
          {ar ? 'هنكلمك على واتساب لتأكيد الميعاد.' : 'We\'ll message you on WhatsApp to confirm the time.'}
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
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-[1fr_1.1fr]">
      {/* summary */}
      <Reveal className="order-2 lg:order-1">
        <div className="sticky top-24 overflow-hidden border-[1.5px] border-sand-300 bg-white pin-card">
          <div className="bg-sea-900 p-6 text-white">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sun-300">
              {t('estimate')}
            </div>
            <div className="mt-2 font-display text-4xl font-extrabold">
              {formatEGP(quote.total, locale)}{' '}
              <span className="text-lg font-semibold text-white/70">{common('egp')}</span>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-white/60">{t('priceNote')}</p>
          </div>
          <div className="space-y-2 p-6 text-sm">
            <Row label={t('perPersonOneWay')} value={`${formatEGP(quote.perPersonPerLeg, locale)} ${common('egp')}`} />
            <Row
              label={direction === 'round_trip' ? bookT('roundTrip') : bookT('oneWay')}
              value={`× ${quote.legs}`}
            />
            <Row
              label={numPeople === 1 ? common('person') : common('people')}
              value={`× ${quote.numPeople}`}
            />
          </div>
        </div>
      </Reveal>

      {/* form */}
      <form onSubmit={handleSubmit(onSubmit)} className="order-1 space-y-5 lg:order-2">
        <div>
          <Label className="mb-2 block">{t('direction')}</Label>
          <div className="grid grid-cols-3 gap-2">
            {DIRECTIONS.map(({ value, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('direction', value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border-[1.5px] px-2 py-3 text-center text-xs font-medium transition-colors',
                  direction === value
                    ? 'border-sea-600 bg-sea-50 text-sea-700'
                    : 'border-sand-300 text-sea-900/60 hover:border-sea-900/25',
                )}
              >
                <Icon className={cn('h-4 w-4', value === 'from_dahab' && 'rotate-180')} />
                {value === 'to_dahab' ? t('toDahab') : value === 'from_dahab' ? t('fromDahab') : t('roundTrip')}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">{t('yourGovernorate')}</Label>
          <Select value={governorate} onValueChange={(v) => v && setValue('governorate', v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={bookT('selectGovernorate')} />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">{t('departDate')}</Label>
            <Input type="date" min={today} {...register('depart_date')} />
            <p className="mt-1 text-xs text-sea-900/40">{t('anyDay')}</p>
          </div>
          {direction === 'round_trip' && (
            <div>
              <Label className="mb-1.5 block">{t('returnDate')}</Label>
              <Input type="date" min={today} {...register('return_date')} />
              <p className="mt-1 text-xs text-sea-900/40">{t('anyDay')}</p>
            </div>
          )}
        </div>

        <div>
          <Label className="mb-1.5 block">{bookT('numPeople')}</Label>
          <Input type="number" min="1" max="50" inputMode="numeric" {...register('num_people')} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5 block">{bookT('fullName')}</Label>
            <Input {...register('full_name')} aria-invalid={Boolean(errors.full_name)} />
            {errors.full_name && <p className="mt-1 text-xs text-red-600">{ar ? 'مطلوب' : 'Required'}</p>}
          </div>
          <div>
            <Label className="mb-1.5 block">{bookT('phoneNumber')}</Label>
            <Input type="tel" dir="ltr" inputMode="tel" {...register('phone')} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <p className="mt-1 text-xs text-red-600">{ar ? 'رقم غير صحيح' : 'Invalid phone'}</p>}
          </div>
        </div>

        <div>
          <Label className="mb-1.5 block">{bookT('notes')}</Label>
          <Textarea rows={3} placeholder={bookT('notesPlaceholder')} {...register('notes')} />
        </div>

        {serverError && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{serverError}</span>
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting || !quote.isPriced}
          className="h-12 w-full rounded-full bg-sun-400 text-base font-semibold text-white hover:bg-sun-500"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t('book')}
        </Button>
        {!quote.isPriced && (
          <p className="text-center text-xs text-sea-900/45">{t('notAvailable')}</p>
        )}
      </form>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sea-900/55">{label}</span>
      <span className="font-semibold text-sea-900">{value}</span>
    </div>
  )
}
