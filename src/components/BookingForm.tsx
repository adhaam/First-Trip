'use client'

import { useCallback, useMemo, useState } from 'react'
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
  governoratesFor, quotePackageV2, quoteStay, quoteTransfer,
  nightsForDuration, upcomingDatesFor, formatEGP, roomsForPeople, upgradeSubtotal,
} from '@/lib/pricing'
import type {
  Accommodation, MealPlan, SinaiTrip, TransferDirection, TransferGovernoratePrice,
  TransferPricing, TransferType,
} from '@/lib/types'
import {
  Send, CheckCircle2, MessageCircle, Loader2, AlertCircle,
  Package, Bed, Bus, Calendar, Info, BedDouble, BedSingle, UtensilsCrossed, Plus, X, Mountain, Users, Sparkles,
} from 'lucide-react'
import { RoomAllocator, type RoomAllocation, ROOM_OCCUPANCY } from '@/components/RoomAllocator'
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
  package_departure_date: z.string().optional(), // chosen departure date
  package_transfer_type: z.enum(['package_bus', 'hiace']).optional(),

  // stay-only
  nights: z.string().optional(),
  check_in_date: z.string().optional(),

  // room + meal plan (package & stay-only)
  room_type: z.enum(['double', 'single', 'triple']).optional(),
  meal_plan_key: z.string().optional(),

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
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  const required = (path: keyof typeof value) => {
    if (!value[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: 'Required' })
  }
  if (value.mode === 'package') required('package_governorate')
  if (value.mode === 'stay-only') required('check_in_date')
  if (value.mode === 'transfer-only') {
    required('transfer_governorate')
    required('transfer_date')
    if (value.transfer_direction === 'round_trip') required('transfer_return_date')
  }
})

type FormData = z.infer<typeof schema>

interface Props {
  accommodation: Accommodation
  pricing: TransferPricing
  whatsapp?: string | null
  sinaiTrips?: SinaiTrip[]
  /** Trip ids bundled into every package by default — their price is baked into the total. */
  includedTripIds?: string[]
}

export function BookingForm({
  accommodation, pricing, whatsapp, sinaiTrips = [], includedTripIds = [],
}: Props) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  const [extraTripIds, setExtraTripIds] = useState<string[]>([])
  const [addingTrip, setAddingTrip] = useState(false)
  // Room allocation — used when party needs multiple room types
  const [roomAllocations, setRoomAllocations] = useState<RoomAllocation[]>([])
  const [useAllocator, setUseAllocator] = useState(false)
  // Selected room upgrade (client submits only the ID — server derives price)
  const [upgradeId, setUpgradeId] = useState<string>('')

  const handleAllocationsChange = useCallback((allocs: RoomAllocation[]) => {
    setRoomAllocations(allocs)
  }, [])

  // Active room upgrades for this accommodation (empty = no upgrades available)
  const activeUpgrades = useMemo(
    () => (accommodation.room_upgrades ?? []).filter((u) => u.is_active),
    [accommodation.room_upgrades],
  )

  // Resolved upgrade object for display (price is trusted from server-loaded data)
  const selectedUpgrade = useMemo(
    () => activeUpgrades.find((u) => u.id === upgradeId) ?? null,
    [activeUpgrades, upgradeId],
  )

  const totalAllocated = roomAllocations.reduce(
    (sum, a) => sum + ROOM_OCCUPANCY[a.type] * a.count,
    0,
  )

  const activeMealPlans = useMemo(
    () => (accommodation.meal_plans || []).filter((m) => m.is_active),
    [accommodation.meal_plans],
  )
  const hasRoomPricing = Boolean(accommodation.price_double_room) || Boolean(accommodation.price_single_room)

  const {
    register, handleSubmit, watch, setValue, formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      mode: 'package',
      num_people: '2',
      duration: '4',
      nights: '2',
      package_transfer_type: 'package_bus',
      transfer_type: 'package_bus',
      transfer_direction: 'round_trip',
      room_type: 'double',
      meal_plan_key: activeMealPlans[0]?.key || '',
    },
  })

  const mode = watch('mode') as Mode
  const duration = watch('duration') || '4'
  const packageGov = watch('package_governorate')
  const packageDepartureDate = watch('package_departure_date')
  const packageTransferType = (watch('package_transfer_type') ?? 'hiace') as TransferType
  const packageDirection = 'round_trip' as const // always round_trip for packages
  const nights = Math.max(1, parseInt(watch('nights') || '1') || 1)
  const stayCheckIn = watch('check_in_date')
  const transferType = (watch('transfer_type') ?? 'hiace') as TransferType
  const transferGov = watch('transfer_governorate')
  const transferDirection = (watch('transfer_direction') ?? 'round_trip') as TransferDirection
  const numPeople = Math.max(1, parseInt(watch('num_people') || '1') || 1)
  const roomType = (watch('room_type') ?? 'double') as 'double' | 'single' | 'triple'
  const allocationComplete = useAllocator ? totalAllocated === numPeople : true
  const mealPlanKey = watch('meal_plan_key') || ''

  const selectedMealPlan = useMemo(
    () => activeMealPlans.find((m) => m.key === mealPlanKey),
    [activeMealPlans, mealPlanKey],
  )
  const mealPlanPricePerNight = selectedMealPlan?.price_per_person_per_night || 0

  const includedTrips = useMemo(
    () => sinaiTrips.filter((trip) => includedTripIds.includes(trip.id)),
    [sinaiTrips, includedTripIds],
  )
  const extraTripsAvailable = useMemo(
    () => sinaiTrips.filter((trip) => !includedTripIds.includes(trip.id) && !extraTripIds.includes(trip.id)),
    [sinaiTrips, includedTripIds, extraTripIds],
  )
  const selectedExtraTrips = useMemo(
    () => sinaiTrips.filter((trip) => extraTripIds.includes(trip.id)),
    [sinaiTrips, extraTripIds],
  )
  const numRooms = roomsForPeople(roomType, numPeople)
  const packageNights = nightsForDuration(duration === '5' ? 5 : 4)

  // ─── governorate options ───
  // Picked first, before the bus/hiace choice — so we show the union of
  // governorates configured for either transfer type. The per-governorate
  // surcharge for whichever type gets picked afterward is resolved later,
  // at quote time, from the matching (type, code) pair.
  const packageGovs = useMemo(() => {
    const merged = new Map<string, TransferGovernoratePrice>()
    for (const g of [
      ...governoratesFor(pricing, 'package_bus'),
      ...governoratesFor(pricing, 'hiace'),
    ]) {
      if (!merged.has(g.governorate_code)) merged.set(g.governorate_code, g)
    }
    return [...merged.values()].sort((a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en))
  }, [pricing])
  const transferGovs = useMemo(() => {
    const merged = new Map<string, TransferGovernoratePrice>()
    for (const g of [
      ...governoratesFor(pricing, 'package_bus'),
      ...governoratesFor(pricing, 'hiace'),
    ]) {
      if (!merged.has(g.governorate_code)) merged.set(g.governorate_code, g)
    }
    return [...merged.values()].sort(
      (a, b) => a.sort_order - b.sort_order || a.name_en.localeCompare(b.name_en),
    )
  }, [pricing])

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
    if (packageTransferType === 'hiace') return upcomingDatesFor(null, 14)
    const departDay = duration === '5' ? 0 : 4 // Sun(0) or Thu(4)
    return upcomingDatesFor([departDay], 8) // next 8 options
  }, [duration, packageTransferType])

  const packageReturnDate = useMemo(() => {
    const base = packageDepartureDate || packageDepartureDates[0]
    if (!base) return ''
    if (packageTransferType === 'hiace') {
      const date = new Date(`${base}T00:00:00`)
      date.setDate(date.getDate() + (duration === '5' ? 5 : 4))
      return date.toISOString().slice(0, 10)
    }
    const returnDay = duration === '5' ? 5 : 1 // Fri(5) or Mon(1)
    const [ret] = upcomingDatesFor([returnDay], 1, new Date(`${base}T00:00:00`))
    return ret
  }, [duration, packageDepartureDate, packageDepartureDates, packageTransferType])

  // ─── live price preview (server recomputes on submit) ───
  // Room + meal-plan pricing when this property has room prices configured;
  // otherwise fall back to the legacy flat price_4day/price_5day/price_per_night.
  const packageQuote = useMemo(() => {
    if (mode !== 'package') return null
    if (hasRoomPricing) {
      return quotePackageV2({
        pricing,
        accommodation,
        roomType,
        checkIn: packageDepartureDate || packageDepartureDates[0],
        mealPlanPricePerNight,
        nights: packageNights,
        numRooms,
        includedTrips,
        extraTrips: selectedExtraTrips,
        transferType: packageTransferType,
        governorateCode: packageGov,
        direction: packageDirection,
        numPeople,
      })
    }
    // legacy fallback
    const accommodationPrice =
      duration === '5' ? Number(accommodation.price_5day) : Number(accommodation.price_4day)
    const transfer = quoteTransfer({
      pricing, type: 'package_bus', governorateCode: packageGov, direction: packageDirection, numPeople,
    })
    return {
      accommodationSubtotal: accommodationPrice * numPeople,
      mealSubtotal: 0,
      includedTripsSubtotal: 0,
      transfer,
      transferSubtotal: transfer.total,
      extraTripsSubtotal: 0,
      numRooms,
      numPeople: transfer.numPeople,
      total: (accommodationPrice + transfer.perPerson) * transfer.numPeople,
    }
  }, [
    mode, hasRoomPricing, accommodation, pricing, roomType, mealPlanPricePerNight, duration,
    packageNights, includedTrips, selectedExtraTrips, packageTransferType, packageGov, packageDirection, numPeople,
    numRooms, packageDepartureDate, packageDepartureDates,
  ])

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

  const stayQuote = useMemo(() => {
    if (mode !== 'stay-only') return null
    if (hasRoomPricing) {
      if (!stayCheckIn) return null
      return quoteStay({
        accommodation, roomType, checkIn: stayCheckIn, mealPlanPricePerNight,
        nights, numPeople, numRooms,
      })
    }
    // legacy fallback
    const perNightPerPerson = Number(accommodation.price_per_night)
    return {
      nightly: [],
      accommodationSubtotal: perNightPerPerson * nights * numPeople,
      mealSubtotal: 0,
      numRooms,
      nights,
      numPeople,
      total: perNightPerPerson * nights * numPeople,
    }
  }, [mode, hasRoomPricing, accommodation, roomType, mealPlanPricePerNight, nights, numPeople, numRooms, stayCheckIn])

  const upgradeTotal = useMemo(() => {
    if (!selectedUpgrade || mode === 'transfer-only') return 0
    if (mode === 'package') {
      return upgradeSubtotal(
        selectedUpgrade.extra_price_per_night,
        packageQuote?.numRooms ?? numRooms,
        packageNights,
      )
    }
    return upgradeSubtotal(
      selectedUpgrade.extra_price_per_night,
      stayQuote?.numRooms ?? numRooms,
      nights,
    )
  }, [selectedUpgrade, mode, packageQuote, stayQuote, numRooms, packageNights, nights])

  const total =
    (mode === 'package'
      ? packageQuote?.total ?? 0
      : mode === 'transfer-only'
      ? transferQuote?.total ?? 0
      : stayQuote?.total ?? 0) + upgradeTotal

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
          customer_email: data.email || undefined,
          booking_type: 'package' as const,
          accommodation_id: accommodation.id,
          governorate: data.package_governorate,
          trip_date: packageDepartureDate || packageDepartureDates[0],
          return_date: packageReturnDate,
          duration: duration === '5' ? 5 : 4,
          transfer_type: hasRoomPricing ? packageTransferType : ('package_bus' as const),
          transfer_direction: 'round_trip' as const,
          room_type: hasRoomPricing && !useAllocator ? roomType : undefined,
          room_allocations: hasRoomPricing && useAllocator && roomAllocations.length > 0 ? roomAllocations : undefined,
          meal_plan_key: hasRoomPricing ? (mealPlanKey || undefined) : undefined,
          upgrade_id: hasRoomPricing && upgradeId ? upgradeId : undefined,
          extra_trip_ids: hasRoomPricing && extraTripIds.length ? extraTripIds : undefined,
          num_people: numPeople,
          notes: data.notes || undefined,
        }
      }
      if (data.mode === 'stay-only') {
        return {
          customer_name: data.full_name,
          customer_phone: data.phone,
          customer_email: data.email || undefined,
          booking_type: 'accommodation-only' as const,
          accommodation_id: accommodation.id,
          trip_date: data.check_in_date || undefined,
          nights,
          room_type: hasRoomPricing && !useAllocator ? roomType : undefined,
          room_allocations: hasRoomPricing && useAllocator && roomAllocations.length > 0 ? roomAllocations : undefined,
          meal_plan_key: hasRoomPricing ? (mealPlanKey || undefined) : undefined,
          upgrade_id: hasRoomPricing && upgradeId ? upgradeId : undefined,
          num_people: numPeople,
          notes: data.notes || undefined,
        }
      }
      // transfer-only
      return {
        customer_name: data.full_name,
        customer_phone: data.phone,
        customer_email: data.email || undefined,
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

  // Always a single vertical stack: form card, then the price summary below
  // it. This component now lives inside a fixed-width sidebar column on
  // desktop (see ProductDetailClient), so it must never try to split itself
  // into its own side-by-side columns — that's what caused the earlier
  // squeeze bug when the sidebar wasn't wide enough for both.
  return (
    <div className="flex flex-col gap-6">

      {/* ─── booking form card ─── */}
      <div className="overflow-hidden rounded-3xl border-[1.5px] border-sea-100 bg-card shadow-sm">
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
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>


            {hasRoomPricing && (
              <>
                {/* Transfer type — bus vs Hiace */}
                <div>
                  <Label className="mb-2 block">{ar ? 'نوع الانتقال' : 'Transfer type'}</Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TransferTypeCard
                      active={packageTransferType === 'hiace'}
                      title={t('transferTypeHiace')}
                      desc={t('transferTypeHiaceDesc')}
                      onClick={() => setValue('package_transfer_type', 'hiace')}
                    />
                    <TransferTypeCard
                      active={packageTransferType === 'package_bus'}
                      title={t('transferTypeBus')}
                      desc={t('transferTypeBusDesc')}
                      onClick={() => setValue('package_transfer_type', 'package_bus')}
                    />
                  </div>
                </div>

                {/* Room type / allocation */}
                {hasRoomPricing && (
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <Label>{ar ? 'نوع الغرفة' : 'Room type'}</Label>
                      {numPeople > 2 && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseAllocator(!useAllocator)
                            if (!useAllocator) setRoomAllocations([])
                          }}
                          className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {useAllocator
                            ? (ar ? 'رجوع للاختيار البسيط' : 'Use simple selection')
                            : (ar ? 'وزّع على أكثر من نوع غرفة' : 'Distribute across room types')}
                        </button>
                      )}
                    </div>

                    {useAllocator ? (
                      <RoomAllocator
                        numPeople={numPeople}
                        allocations={roomAllocations}
                        onChange={handleAllocationsChange}
                      />
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        <RoomTypeCard
                          icon={BedSingle}
                          active={roomType === 'single'}
                          title={ar ? 'سينجل' : 'Single'}
                          desc={ar ? 'غرفة لوحدك' : 'A room to yourself'}
                          onClick={() => setValue('room_type', 'single')}
                        />
                        <RoomTypeCard
                          icon={BedDouble}
                          active={roomType === 'double'}
                          title={ar ? 'دبل' : 'Double'}
                          desc={ar ? 'غرفة لفردين' : 'Sleeps up to 2'}
                          onClick={() => setValue('room_type', 'double')}
                        />
                        <RoomTypeCard
                          icon={BedDouble}
                          active={roomType === 'triple'}
                          title={ar ? 'تريبل' : 'Triple'}
                          desc={ar ? 'غرفة لـ 3 أفراد' : 'Sleeps up to 3'}
                          onClick={() => setValue('room_type', 'triple')}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Meal plan */}
                {activeMealPlans.length > 0 && (
                  <div>
                    <Label className="mb-2 flex items-center gap-1.5">
                      <UtensilsCrossed className="h-4 w-4 text-sea-500" />
                      {ar ? 'نوع الإقامة' : 'Meal plan'}
                    </Label>
                    <div className="grid gap-2">
                      {activeMealPlans.map((plan) => (
                        <MealPlanCard
                          key={plan.key}
                          plan={plan}
                          ar={ar}
                          active={mealPlanKey === plan.key}
                          onClick={() => setValue('meal_plan_key', plan.key)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Room upgrade */}
                {activeUpgrades.length > 0 && (
                  <div>
                    <Label className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sea-500" />
                      {ar ? 'ترقية الغرفة' : 'Room upgrade'}
                    </Label>
                    <div className="grid gap-2">
                      <UpgradeCard
                        selected={upgradeId === ''}
                        label={ar ? 'بدون ترقية' : 'No upgrade'}
                        extra={null}
                        onClick={() => setUpgradeId('')}
                      />
                      {activeUpgrades.map((u) => (
                        <UpgradeCard
                          key={u.id}
                          selected={upgradeId === u.id}
                          label={ar ? u.name_ar : u.name_en}
                          extra={`+${formatEGP(u.extra_price_per_night, locale)} ${common('egp')} / ${ar ? 'ليلة/غرفة' : 'night per room'}`}
                          onClick={() => setUpgradeId(u.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Extra Sinai trips */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label className="flex items-center gap-1.5">
                      <Mountain className="h-4 w-4 text-sea-500" />
                      {ar ? 'رحلات إضافية' : 'Extra trips'}
                    </Label>
                    {extraTripsAvailable.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setAddingTrip((v) => !v)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-sea-600 hover:text-sea-800"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {ar ? 'إضافة رحلة' : 'Add trip'}
                      </button>
                    )}
                  </div>

                  {addingTrip && (
                    <Select
                      value=""
                      onValueChange={(v) => { if (v) { setExtraTripIds((prev) => [...prev, v]); setAddingTrip(false) } }}
                    >
                      <SelectTrigger className="w-full mb-2">
                        <SelectValue placeholder={ar ? 'اختر رحلة' : 'Choose a trip'} />
                      </SelectTrigger>
                      <SelectContent>
                        {extraTripsAvailable.map((trip) => (
                          <SelectItem key={trip.id} value={trip.id}>
                            {ar ? trip.name_ar : trip.name_en} — {formatEGP(trip.price, locale)} {common('egp')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {selectedExtraTrips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExtraTrips.map((trip) => (
                        <span
                          key={trip.id}
                          className="inline-flex items-center gap-1.5 rounded-full border border-sea-200 bg-sea-50 px-3 py-1 text-xs font-medium text-sea-700"
                        >
                          {ar ? trip.name_ar : trip.name_en}
                          <button
                            type="button"
                            onClick={() => setExtraTripIds((prev) => prev.filter((id) => id !== trip.id))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

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

            {hasRoomPricing && (
              <>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>{ar ? 'نوع الغرفة' : 'Room type'}</Label>
                    {numPeople > 2 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUseAllocator(!useAllocator)
                          if (!useAllocator) setRoomAllocations([])
                        }}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"
                      >
                        <Users className="h-3.5 w-3.5" />
                        {useAllocator
                          ? (ar ? 'رجوع للاختيار البسيط' : 'Use simple selection')
                          : (ar ? 'وزّع على أكثر من نوع غرفة' : 'Distribute across room types')}
                      </button>
                    )}
                  </div>

                  {useAllocator ? (
                    <RoomAllocator
                      numPeople={numPeople}
                      allocations={roomAllocations}
                      onChange={handleAllocationsChange}
                    />
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <RoomTypeCard
                        icon={BedSingle}
                        active={roomType === 'single'}
                        title={ar ? 'سينجل' : 'Single'}
                        desc={ar ? 'غرفة لوحدك' : 'A room to yourself'}
                        onClick={() => setValue('room_type', 'single')}
                      />
                      <RoomTypeCard
                        icon={BedDouble}
                        active={roomType === 'double'}
                        title={ar ? 'دبل' : 'Double'}
                        desc={ar ? 'غرفة لفردين' : 'Sleeps up to 2'}
                        onClick={() => setValue('room_type', 'double')}
                      />
                      <RoomTypeCard
                        icon={BedDouble}
                        active={roomType === 'triple'}
                        title={ar ? 'تريبل' : 'Triple'}
                        desc={ar ? 'غرفة لـ 3 أفراد' : 'Sleeps up to 3'}
                        onClick={() => setValue('room_type', 'triple')}
                      />
                    </div>
                  )}
                </div>

                {activeMealPlans.length > 0 && (
                  <div>
                    <Label className="mb-2 flex items-center gap-1.5">
                      <UtensilsCrossed className="h-4 w-4 text-sea-500" />
                      {ar ? 'نوع الإقامة' : 'Meal plan'}
                    </Label>
                    <div className="grid gap-2">
                      {activeMealPlans.map((plan) => (
                        <MealPlanCard
                          key={plan.key}
                          plan={plan}
                          ar={ar}
                          active={mealPlanKey === plan.key}
                          onClick={() => setValue('meal_plan_key', plan.key)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Room upgrade */}
                {activeUpgrades.length > 0 && (
                  <div>
                    <Label className="mb-2 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-sea-500" />
                      {ar ? 'ترقية الغرفة' : 'Room upgrade'}
                    </Label>
                    <div className="grid gap-2">
                      <UpgradeCard
                        selected={upgradeId === ''}
                        label={ar ? 'بدون ترقية' : 'No upgrade'}
                        extra={null}
                        onClick={() => setUpgradeId('')}
                      />
                      {activeUpgrades.map((u) => (
                        <UpgradeCard
                          key={u.id}
                          selected={upgradeId === u.id}
                          label={ar ? u.name_ar : u.name_en}
                          extra={`+${formatEGP(u.extra_price_per_night, locale)} ${common('egp')} / ${ar ? 'ليلة/غرفة' : 'night per room'}`}
                          onClick={() => setUpgradeId(u.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ─── TRANSFER-ONLY MODE ─── */}
        {mode === 'transfer-only' && (
          <>
            {/* governorate — picked first, before the ride type */}
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
                        ? 'border-sun-500 bg-sun-50 text-sea-900'
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
          <Label className="mb-1.5 block">{ar ? 'الإيميل (اختياري)' : 'Email (optional)'}</Label>
          <Input
            type="email"
            dir="ltr"
            inputMode="email"
            placeholder="example@email.com"
            {...register('email')}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
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
            disabled={submitting || !allocationComplete}
            title={!allocationComplete ? (ar ? 'وزّع كل الضيوف أولاً' : 'Allocate all guests before submitting') : undefined}
            className="h-12 w-full rounded-full bg-gradient-to-r from-sun-500 to-sun-400 text-base font-semibold text-white shadow-sm transition-all hover:from-sun-600 hover:to-sun-500 hover:shadow-md disabled:opacity-60"
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

      {/* ─── price summary — always below the form fields ─── */}
      <div>
        <div className="overflow-hidden rounded-3xl border-[1.5px] border-sea-100 bg-card shadow-sm">
          <div className="bg-gradient-to-br from-sea-50 to-sun-50 p-6">
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-sea-900/50">
              {t('priceBreakdown')}
            </div>

            <div className="mt-3 space-y-1.5 text-sm">
              {mode === 'package' && packageQuote && (
                <>
                  <Line
                    label={`${t('accommodationLine')} · ${packageQuote.numRooms} ${packageQuote.numRooms === 1 ? (ar ? 'غرفة' : 'room') : (ar ? 'غرف' : 'rooms')}`}
                    value={`${formatEGP(packageQuote.accommodationSubtotal, locale)} ${common('egp')}`}
                  />
                  {packageQuote.mealSubtotal > 0 && (
                    <Line
                      label={selectedMealPlan ? (ar ? selectedMealPlan.label_ar : selectedMealPlan.label_en) : ''}
                      value={`${formatEGP(packageQuote.mealSubtotal, locale)} ${common('egp')}`}
                    />
                  )}
                  {includedTrips.length > 0 && (
                    <Line
                      label={ar ? 'رحلات مضمّنة' : 'Included trips'}
                      value={`${formatEGP(packageQuote.includedTripsSubtotal, locale)} ${common('egp')}`}
                    />
                  )}
                  <Line
                    label={t('transferLine')}
                    value={
                      packageQuote.transfer.isPriced
                        ? `${formatEGP(packageQuote.transferSubtotal, locale)} ${common('egp')}`
                        : '—'
                    }
                  />
                  {packageQuote.extraTripsSubtotal > 0 && (
                    <Line
                      label={ar ? 'رحلات إضافية' : 'Extra trips'}
                      value={`${formatEGP(packageQuote.extraTripsSubtotal, locale)} ${common('egp')}`}
                    />
                  )}
                  {selectedUpgrade && upgradeTotal > 0 && (
                    <Line
                      label={ar ? `ترقية · ${selectedUpgrade.name_ar}` : `Upgrade · ${selectedUpgrade.name_en}`}
                      value={`${formatEGP(upgradeTotal, locale)} ${common('egp')}`}
                    />
                  )}
                </>
              )}
              {mode === 'stay-only' && stayQuote && (
                <>
                  <Line
                    label={`${t('accommodationLine')} · ${nights} ${
                      nights === 1 ? common('night') : common('nights')
                    }`}
                    value={`${formatEGP(stayQuote.total, locale)} ${common('egp')}`}
                  />
                  {selectedUpgrade && upgradeTotal > 0 && (
                    <Line
                      label={ar ? `ترقية · ${selectedUpgrade.name_ar}` : `Upgrade · ${selectedUpgrade.name_en}`}
                      value={`${formatEGP(upgradeTotal, locale)} ${common('egp')}`}
                    />
                  )}
                </>
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
        </div>
      </div>

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
          ? 'border-sun-500 bg-sun-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-sun-500 text-white' : 'bg-sand-100 text-sea-700',
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

function RoomTypeCard({
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
        'flex items-center gap-2.5 rounded-2xl border-[1.5px] p-3 text-start transition-colors',
        active ? 'border-sun-500 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-sea-600' : 'text-sea-900/40')} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-sea-900">{title}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-sea-900/55">{desc}</span>
      </span>
    </button>
  )
}

function MealPlanCard({
  plan, ar, active, onClick,
}: {
  plan: MealPlan
  ar: boolean
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 text-start transition-colors',
        active ? 'border-sun-500 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span className="text-sm font-medium text-sea-900">{ar ? plan.label_ar : plan.label_en}</span>
      <span className="shrink-0 text-xs font-semibold text-sea-600">
        {plan.price_per_person_per_night > 0 ? `+${plan.price_per_person_per_night.toLocaleString()}` : (ar ? 'مجاني' : 'Free')}
      </span>
    </button>
  )
}

function UpgradeCard({
  selected, label, extra, onClick,
}: {
  selected: boolean
  label: string
  extra: string | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-between gap-3 rounded-2xl border-[1.5px] px-4 py-2.5 text-start transition-colors',
        selected ? 'border-sun-500 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span className="text-sm font-medium text-sea-900">{label}</span>
      {extra && (
        <span className="shrink-0 text-xs font-semibold text-sun-600">{extra}</span>
      )}
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
          ? 'border-sun-500 bg-sun-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <div className="text-sm font-semibold text-sea-900">{title}</div>
      <div className="mt-1 text-xs leading-snug text-sea-900/60">{desc}</div>
    </button>
  )
}
