'use client'

import { useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { motion } from 'framer-motion'
import { Accommodation } from '@/lib/types'
import { GOVERNORATES, WHATSAPP_NUMBER } from '@/lib/constants'
import { Send, CheckCircle2, MessageCircle } from 'lucide-react'

const bookingSchema = z.object({
  booking_type: z.enum(['package', 'accommodation-only', 'transfer-only']),
  nights: z.string().optional(),
  duration: z.string().optional(),
  governorate: z.string().optional(),
  travel_date: z.string().optional(),
  num_people: z.string().min(1, 'Required'),
  full_name: z.string().min(3, 'Min 3 chars'),
  phone: z.string().min(10, 'Invalid phone'),
  notes: z.string().optional(),
})

type BookingFormData = z.infer<typeof bookingSchema>

interface Props {
  accommodation: Accommodation
}

export function BookingForm({ accommodation }: Props) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const [submitted, setSubmitted] = useState(false)
  const [calculatedPrice, setCalculatedPrice] = useState<number | null>(null)

  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      booking_type: 'package',
      num_people: '2',
    }
  })

  const bookingType = watch('booking_type')
  const duration = watch('duration')
  const governorate = watch('governorate')
  const numPeople = parseInt(watch('num_people') || '1')

  // Price calculation
  useMemo(() => {
    let price = 0
    if (bookingType === 'package') {
      const days = parseInt(duration || '4')
      price = days === 4 ? accommodation.price_4day : accommodation.price_5day
      const govSurcharge = GOVERNORATES.find(g => g.id === governorate)?.surcharge || 0
      price += govSurcharge
    } else if (bookingType === 'accommodation-only') {
      price = accommodation.price_per_night * parseInt(watch('nights') || '1')
    } else if (bookingType === 'transfer-only') {
      const govSurcharge = GOVERNORATES.find(g => g.id === governorate)?.surcharge || 300
      price = 300 + govSurcharge
    }
    setCalculatedPrice(price * numPeople)
  }, [bookingType, duration, governorate, numPeople, accommodation, watch])

  const onSubmit = async (data: BookingFormData) => {
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accommodation_id: accommodation.id,
          booking_type: data.booking_type,
          full_name: data.full_name,
          phone: data.phone,
          travel_date: data.travel_date || null,
          num_people: parseInt(data.num_people),
          notes: data.notes || null,
          nights: data.nights ? parseInt(data.nights) : null,
        }),
      })
      if (!res.ok) {
        console.error('Booking submission failed:', await res.text())
        return
      }
    } catch (err) {
      console.error('Booking submission error:', err)
    }
    setSubmitted(true)
  }

  const whatsappLink = () => {
    const accName = locale === 'ar' ? accommodation.name_ar : accommodation.name_en
    const text = encodeURIComponent(
      locale === 'ar'
        ? `حجز جديد - ${accName}\nالنوع: ${bookingType}\nالأشخاص: ${numPeople}\n${calculatedPrice ? `السعر التقريبي: ${calculatedPrice} ج.م` : ''}`
        : `New Booking - ${accName}\nType: ${bookingType}\nPeople: ${numPeople}\n${calculatedPrice ? `Estimated: ${calculatedPrice} EGP` : ''}`
    )
    return `https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}?text=${text}`
  }

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {locale === 'ar' ? 'تم إرسال طلبك!' : 'Booking Sent!'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {locale === 'ar'
                ? 'هنتواصل معاك في أقرب وقت لتأكيد الحجز'
                : 'We\'ll contact you shortly to confirm your booking'}
            </p>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center justify-center h-9 px-4 rounded-full font-medium bg-green-600 hover:bg-green-700 text-white transition-all w-full"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              {locale === 'ar' ? 'تواصل عبر واتساب' : 'Chat on WhatsApp'}
            </a>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">
            {t('bookingForm')}
          </h3>

          {calculatedPrice !== null && (
            <div className="bg-gradient-to-r from-brand-blue/10 to-brand-orange/10 rounded-xl p-4 mb-5 border border-brand-blue/20">
              <div className="text-xs text-gray-500 mb-1">
                {locale === 'ar' ? 'السعر التقريبي' : 'Estimated Price'}
              </div>
              <div className="text-3xl font-bold text-brand-blue">
                {calculatedPrice.toLocaleString()} {common('egp')}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {locale === 'ar' ? '* السعر النهائي بعد التواصل' : '* Final price after confirmation'}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Booking Type */}
            <div>
              <Label>{t('bookingType')}</Label>
              <RadioGroup
                value={bookingType}
                onValueChange={(v) => setValue('booking_type', v as 'package' | 'accommodation-only' | 'transfer-only')}
                className="mt-2"
              >
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="package" id="package" />
                  <Label htmlFor="package" className="cursor-pointer font-normal">
                    {locale === 'ar' ? 'باكدج كامل (انتقالات + إقامة + رحلتين)' : 'Full Package (Transfer + Stay + 2 Trips)'}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="accommodation-only" id="accommodation-only" />
                  <Label htmlFor="accommodation-only" className="cursor-pointer font-normal">
                    {t('accommodationOnly')}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                  <RadioGroupItem value="transfer-only" id="transfer-only" />
                  <Label htmlFor="transfer-only" className="cursor-pointer font-normal">
                    {locale === 'ar' ? 'انتقالات فقط' : 'Transfer Only'}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Duration OR Nights */}
            {bookingType === 'package' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('duration')}</Label>
                  <Select onValueChange={(v) => v && setValue('duration', v)} defaultValue="4">
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t('duration')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">{t('day4')}</SelectItem>
                      <SelectItem value="5">{t('day5')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('governorate')}</Label>
                  <Select onValueChange={(v) => v && setValue('governorate', v as string)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t('selectGovernorate')} />
                    </SelectTrigger>
                    <SelectContent>
                      {GOVERNORATES.map(g => (
                        <SelectItem key={g.id} value={g.id}>
                          {locale === 'ar' ? g.name_ar : g.name_en}
                          {g.surcharge > 0 ? ` (+${g.surcharge})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {bookingType === 'accommodation-only' && (
              <div>
                <Label>{t('nights')}</Label>
                <Select onValueChange={(v) => v && setValue('nights', v as string)} defaultValue="1">
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('nights')} />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6, 7].map(n => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} {locale === 'ar' ? 'ليلة' : n === 1 ? 'night' : 'nights'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {bookingType === 'transfer-only' && (
              <div>
                <Label>{t('governorate')}</Label>
                <Select onValueChange={(v) => v && setValue('governorate', v as string)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('selectGovernorate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GOVERNORATES.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {locale === 'ar' ? g.name_ar : g.name_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Travel Date */}
            <div>
              <Label>{t('travelDate')}</Label>
              <Input
                type="date"
                className="mt-1"
                {...register('travel_date')}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            {/* Num People */}
            <div>
              <Label>{t('numPeople')}</Label>
              <Input
                type="number"
                min="1"
                max="50"
                className="mt-1"
                {...register('num_people')}
              />
            </div>

            {/* Name + Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{t('fullName')}</Label>
                <Input {...register('full_name')} className="mt-1" />
                {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <Label>{t('phoneNumber')}</Label>
                <Input type="tel" {...register('phone')} className="mt-1" dir="ltr" />
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>{t('notes')}</Label>
              <Textarea
                rows={3}
                placeholder={t('notesPlaceholder')}
                className="mt-1"
                {...register('notes')}
              />
            </div>

            <div className="space-y-2 pt-2">
              <Button type="submit" className="w-full bg-brand-orange hover:bg-brand-orange-dark" size="lg">
                <Send className="h-4 w-4 mr-2" />
                {t('submit')}
              </Button>
              <a
                href={whatsappLink()}
                target="_blank"
                rel="noopener"
                className="inline-flex items-center justify-center h-12 px-4 rounded-full font-medium border border-green-500 text-green-600 hover:bg-green-50 transition-all w-full"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                {t('whatsappBooking')}
              </a>
            </div>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  )
}