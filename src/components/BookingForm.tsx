'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import {
  PACKAGE_DEPARTURE_DAYS, PACKAGE_RETURN_DAYS,
  governoratesFor, quotePackageV2, quoteStay, quoteTransfer,
  nightsForDuration, upcomingDatesFor, formatEGP, roomsForPeople, upgradeSubtotal,
} from '@/lib/pricing'
import type {
  Accommodation, MealPlan, SinaiTrip, TransferDirection, TransferGovernoratePrice,
  TransferPricing, TransferType, TripPackage,
} from '@/lib/types'
import {
  Send, CheckCircle2, MessageCircle, Loader2, AlertCircle,
  Package, Bed, Bus, Calendar, Info, BedDouble, BedSingle, UtensilsCrossed, Plus, X, Mountain, Users, Sparkles, Layers, Check,
} from 'lucide-react'
import { RoomAllocator, type RoomAllocation, ROOM_OCCUPANCY } from '@/components/RoomAllocator'
import { HoneypotField } from '@/components/HoneypotField'
import { Turnstile } from '@/components/Turnstile'
import { trackConversion, trackRequestFailure } from '@/lib/conversion'
import { cn } from '@/lib/utils'
import { formatAmount } from '@/lib/format'

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
  // Messages are stable CODES, not display text — the schema lives outside the
  // component and cannot reach the translator. `fieldError()` below maps them.
  num_people: z.string().min(1, 'required'),
  full_name: z.string().min(3, 'nameShort'),
  phone: z.string().min(10, 'phoneInvalid'),
  email: z.string().email('emailInvalid').optional().or(z.literal('')),
  notes: z.string().optional(),
}).superRefine((value, ctx) => {
  const required = (path: keyof typeof value) => {
    if (!value[path]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message: 'required' })
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
  tripPackages?: TripPackage[]
}

export function BookingForm({
  accommodation, pricing, whatsapp, sinaiTrips = [], tripPackages = [],
}: Props) {
  const t = useTranslations('book')
  const common = useTranslations('common')
  const forms = useTranslations('forms')
  const sinai = useTranslations('sinai')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')
  // Focus targets for the two moments a keyboard/SR user must be moved:
  // a rejected submit, and a successful one.
  const errorSummaryRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const [showErrorSummary, setShowErrorSummary] = useState(false)
  const [honeypot, setHoneypot] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [extraTripIds, setExtraTripIds] = useState<string[]>([])
  const [addingTrip, setAddingTrip] = useState(false)
  const [selectedPackageIds, setSelectedPackageIds] = useState<string[]>([])
  const [tripSelectionTab, setTripSelectionTab] = useState<'trips' | 'packages'>('trips')
  const [tripSelectionNotice, setTripSelectionNotice] = useState('')
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

  const selectedPackages = useMemo(
    () => tripPackages.filter((p) => selectedPackageIds.includes(p.id)),
    [tripPackages, selectedPackageIds],
  )
  // Trips already covered by a selected Trip Package — never offerable as an
  // individually-selected extra trip at the same time (duplicate protection).
  const packageTripIds = useMemo(
    () => new Set(selectedPackages.flatMap((p) => (p.trips || []).map((t) => t.id))),
    [selectedPackages],
  )
  const packagesSubtotal = useMemo(
    () => selectedPackages.reduce((sum, p) => sum + (p.totals?.packageTotal ?? 0), 0),
    [selectedPackages],
  )

  const extraTripsAvailable = useMemo(
    () => sinaiTrips.filter((trip) => !extraTripIds.includes(trip.id) && !packageTripIds.has(trip.id)),
    [sinaiTrips, extraTripIds, packageTripIds],
  )
  const selectedExtraTrips = useMemo(
    () => sinaiTrips.filter((trip) => extraTripIds.includes(trip.id)),
    [sinaiTrips, extraTripIds],
  )

  const addPackage = (pkg: TripPackage) => {
    const otherSelected = selectedPackages.filter((p) => p.id !== pkg.id)
    const otherTripIds = new Set(otherSelected.flatMap((p) => (p.trips || []).map((t) => t.id)))
    const overlapsPackage = (pkg.trips || []).some((t) => otherTripIds.has(t.id))
    if (overlapsPackage) {
      setTripSelectionNotice(
        ar
          ? 'الباكدج ده فيه رحلة موجودة بالفعل ضمن باكدج اخترته. شيل الباكدج المتعارض أو اختار باكدج مختلف.'
          : "This package includes a trip that's already part of another selected package. Remove the conflicting package or choose a different one.",
      )
      return
    }
    const pkgTripIds = new Set((pkg.trips || []).map((t) => t.id))
    const removedIndividual = extraTripIds.filter((id) => pkgTripIds.has(id))
    if (removedIndividual.length > 0) {
      setExtraTripIds((prev) => prev.filter((id) => !pkgTripIds.has(id)))
      setTripSelectionNotice(
        ar
          ? 'الرحلة دي موجودة بالفعل ضمن باكدج اخترته. غيّر اختيارك عشان ما تتحسبش مرتين.'
          : 'This trip is already included in one of your selected packages. Change your selection to avoid adding it twice.',
      )
    } else {
      setTripSelectionNotice('')
    }
    setSelectedPackageIds((prev) => [...prev, pkg.id])
  }
  const removePackage = (pkgId: string) => {
    setSelectedPackageIds((prev) => prev.filter((id) => id !== pkgId))
    setTripSelectionNotice('')
  }

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
        includedTrips: [],
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
    packageNights, selectedExtraTrips, packageTransferType, packageGov, packageDirection, numPeople,
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
      ? (packageQuote?.total ?? 0) + packagesSubtotal
      : mode === 'transfer-only'
      ? transferQuote?.total ?? 0
      : stayQuote?.total ?? 0) + upgradeTotal

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    return new Date(`${iso}T00:00:00`).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
      weekday: 'long', day: 'numeric', month: 'short',
    })
  }

  // Maps the schema's error codes onto the translated strings. An unknown code
  // falls back to the generic "required" message rather than leaking a code.
  const fieldError = (message?: string) => {
    if (!message) return undefined
    const known = ['required', 'nameShort', 'phoneInvalid', 'emailInvalid'] as const
    return forms(known.includes(message as (typeof known)[number]) ? `err_${message}` : 'err_required')
  }

  /** IDs for the aria-describedby wiring — one place so they cannot drift. */
  const fieldId = (name: string) => `booking-${name}`
  const errorId = (name: string) => `booking-${name}-error`

  // Move focus to the summary when a submit is rejected, so the visitor is told
  // what happened instead of the button silently doing nothing.
  useEffect(() => {
    if (showErrorSummary) errorSummaryRef.current?.focus()
  }, [showErrorSummary])

  // Announce and focus the confirmation when the request goes through.
  useEffect(() => {
    if (submitted) successRef.current?.focus()
  }, [submitted])

  const onInvalid = () => {
    setShowErrorSummary(true)
  }

  // The error summary needs a human label per invalid field, in the visitor's
  // language. Order follows the visual order of the form.
  const FIELD_LABELS: { name: string; label: string }[] = [
    { name: 'num_people', label: t('numPeople') },
    { name: 'full_name', label: t('fullName') },
    { name: 'phone', label: t('phoneNumber') },
    { name: 'email', label: t('emailLabel') },
    { name: 'package_governorate', label: t('governorate') },
    { name: 'check_in_date', label: t('checkIn') },
    { name: 'transfer_governorate', label: t('governorate') },
    { name: 'transfer_date', label: t('transferDate') },
    { name: 'transfer_return_date', label: t('returnDate') },
  ]
  const invalidFields = FIELD_LABELS.filter(
    (field) => Boolean((errors as Record<string, unknown>)[field.name]),
  )

  const onSubmit = async (data: FormData) => {
    // Guards against a double-tap or an Enter-key repeat firing two requests.
    if (submitting) return
    setShowErrorSummary(false)
    if (honeypot) return // silently drop — bot filled the hidden field
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
          trip_package_ids: hasRoomPricing && selectedPackageIds.length ? selectedPackageIds : undefined,
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
        body: JSON.stringify({ ...payload, website: honeypot, turnstile_token: turnstileToken || undefined }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setServerError(
          body.error ||
            (ar
              ? 'حصلت مشكلة في الإرسال. جرّب تاني أو كلمنا على واتساب.'
              : 'Something went wrong. Try again or WhatsApp us.'),
        )
        trackRequestFailure('accommodation', 'server')
        return
      }
      // Fired only after the server confirmed the request. `total` is the same
      // estimate already shown to the customer. No personal field is sent.
      trackConversion('accommodation_request_submitted', {
        content_type: 'accommodation',
        booking_mode: data.mode,
        item_id: accommodation.id,
        item_name: accommodation.name_en,
        item_category: accommodation.type,
        num_people: numPeople,
        value: Math.round(total),
        currency: 'EGP',
        source: 'book_dahab',
      })
      setSubmitted(true)
    } catch {
      trackRequestFailure('accommodation', 'network')
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
      <div
        ref={successRef}
        role="status"
        aria-live="polite"
        tabIndex={-1}
        className="rounded-3xl border-[1.5px] border-sea-100 bg-card p-8 text-center shadow-sm outline-none"
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h3 className="font-display text-xl font-bold text-sea-900">
          {ar ? 'وصلنا طلبك!' : 'Your request is in!'}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-muted">
          {ar
            ? 'هنكلمك خلال ساعات قليلة نأكد الحجز ونظبط التفاصيل.'
            : 'We\'ll call you within a few hours to confirm and sort details.'}
        </p>
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener"
          onClick={() => trackConversion('whatsapp_click', { source: 'book_dahab', content_type: 'accommodation' }, { once: false })}
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] text-sm font-semibold text-on-accent transition-colors hover:bg-[#1FBE59]"
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
      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate aria-labelledby="booking-form-heading" className="space-y-6 p-6">
        <h2 id="booking-form-heading" className="sr-only">{t('bookingType')}</h2>
        {/* ─── mode selector ─── */}
        <div role="radiogroup" aria-labelledby="booking-mode-label">
          <Label id="booking-mode-label" className="mb-2.5 block">{t('bookingType')}</Label>
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

                {/* Individual trips / Trip Packages */}
                <div>
                  <Label className="mb-2 flex items-center gap-1.5">
                    <Mountain className="h-4 w-4 text-sea-500" />
                    {ar ? 'كمّل تجربتك في سيناء' : 'Make more of your Sinai stay'}
                  </Label>

                  {tripSelectionNotice && (
                    <p className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-700">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {tripSelectionNotice}
                    </p>
                  )}

                  <Tabs value={tripSelectionTab} onValueChange={(v) => v && setTripSelectionTab(v as 'trips' | 'packages')}>
                    <TabsList>
                      <TabsTrigger value="trips">{ar ? 'رحلات فردية' : 'Individual Trips'}</TabsTrigger>
                      {tripPackages.length > 0 && (
                        <TabsTrigger value="packages">{ar ? 'باقات رحلات' : 'Trip Packages'}</TabsTrigger>
                      )}
                    </TabsList>

                    <TabsContent value="trips" className="mt-3">
                      <div className="mb-2 flex items-center justify-end">
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
                    </TabsContent>

                    <TabsContent value="packages" className="mt-3 space-y-2.5">
                      {tripPackages.map((pkg) => {
                        const isSelected = selectedPackageIds.includes(pkg.id)
                        const pkgName = ar ? pkg.name_ar : pkg.name_en
                        const tripNames = (pkg.trips || []).map((t) => (ar ? t.name_ar : t.name_en))
                        const pkgTotal = pkg.totals?.packageTotal ?? 0
                        return (
                          <div
                            key={pkg.id}
                            className={cn(
                              'rounded-xl border p-3 transition-colors',
                              isSelected ? 'border-sun-400 bg-sun-50' : 'border-sea-200 bg-white',
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 text-sm font-semibold text-sea-900">
                                  <Layers className="h-3.5 w-3.5 shrink-0 text-sun-700" />
                                  {pkgName}
                                </div>
                                <p className="mt-0.5 text-xs text-ink-subtle">
                                  {sinai('experiencesCount', { count: tripNames.length })} — {tripNames.join(' · ')}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => (isSelected ? removePackage(pkg.id) : addPackage(pkg))}
                                className={cn(
                                  'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors',
                                  isSelected
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'border border-sun-600 text-sun-700 hover:bg-sun-500 hover:text-on-accent',
                                )}
                              >
                                {isSelected ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                                {isSelected ? (ar ? 'تمت الإضافة' : 'Added') : (ar ? 'أضف الباكدج' : 'Add package')}
                              </button>
                            </div>
                            <div className="mt-2 text-sm font-bold text-sea-900">
                              {formatEGP(pkgTotal, locale)} {common('egp')}
                            </div>
                          </div>
                        )
                      })}
                    </TabsContent>
                  </Tabs>
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
                <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
                  <Info className="h-3.5 w-3.5 shrink-0 text-sun-700" />
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
                        ? 'border-sun-600 bg-sun-50 text-sea-900'
                        : 'border-sea-100 text-ink-muted hover:border-sea-300',
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
                  <p className="mt-1.5 text-xs text-ink-subtle">
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
              <div className="flex items-start gap-3 rounded-2xl border border-sea-100 bg-sea-50/40 p-4 text-xs leading-relaxed text-ink-muted">
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
          <Label htmlFor={fieldId('num_people')} className="mb-1.5 block">{t('numPeople')}</Label>
          <Input
            id={fieldId('num_people')}
            type="number"
            min="1"
            max="50"
            inputMode="numeric"
            aria-invalid={Boolean(errors.num_people) || undefined}
            aria-describedby={errors.num_people ? errorId('num_people') : undefined}
            {...register('num_people')}
          />
          {errors.num_people && (
            <p id={errorId('num_people')} role="alert" className="mt-1.5 text-sm text-red-700">
              {fieldError(errors.num_people.message)}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor={fieldId('full_name')} className="mb-1.5 block">
              {t('fullName')} <span className="text-sun-700" aria-hidden>*</span>
              <span className="sr-only">({forms('required')})</span>
            </Label>
            <Input
              id={fieldId('full_name')}
              autoComplete="name"
              required
              aria-invalid={Boolean(errors.full_name) || undefined}
              aria-describedby={errors.full_name ? errorId('full_name') : undefined}
              {...register('full_name')}
            />
            {errors.full_name && (
              <p id={errorId('full_name')} role="alert" className="mt-1.5 text-sm text-red-700">
                {fieldError(errors.full_name.message)}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor={fieldId('phone')} className="mb-1.5 block">
              {t('phoneNumber')} <span className="text-sun-700" aria-hidden>*</span>
              <span className="sr-only">({forms('required')})</span>
            </Label>
            <Input
              id={fieldId('phone')}
              type="tel"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              required
              aria-invalid={Boolean(errors.phone) || undefined}
              aria-describedby={errors.phone ? errorId('phone') : undefined}
              {...register('phone')}
            />
            {errors.phone && (
              <p id={errorId('phone')} role="alert" className="mt-1.5 text-sm text-red-700">
                {fieldError(errors.phone.message)}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor={fieldId('email')} className="mb-1.5 block">
            {t('emailLabel')}{' '}
            <span className="font-normal text-ink-subtle">({forms('optional')})</span>
          </Label>
          <Input
            id={fieldId('email')}
            type="email"
            dir="ltr"
            inputMode="email"
            autoComplete="email"
            placeholder="example@email.com"
            aria-invalid={Boolean(errors.email) || undefined}
            aria-describedby={errors.email ? errorId('email') : undefined}
            {...register('email')}
          />
          {errors.email && (
            <p id={errorId('email')} role="alert" className="mt-1.5 text-sm text-red-700">
              {fieldError(errors.email.message)}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor={fieldId('notes')} className="mb-1.5 block">{t('notes')}</Label>
          <Textarea
            id={fieldId('notes')}
            rows={3}
            placeholder={t('notesPlaceholder')}
            {...register('notes')}
          />
        </div>

        <HoneypotField value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
        <Turnstile onToken={setTurnstileToken} />

        {/* Failed-submit summary. Inline field errors stay exactly where they
            are; this is the focus target that tells a keyboard or screen-reader
            user the submit was rejected and links straight to each bad field. */}
        {showErrorSummary && invalidFields.length > 0 && (
          <div
            ref={errorSummaryRef}
            role="alert"
            tabIndex={-1}
            className="rounded-xl border border-red-300 bg-red-50 p-4 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              {forms('errorSummaryTitle')}
            </p>
            <p className="mt-1 text-sm text-red-800">{forms('errorSummaryIntro')}</p>
            <ul className="mt-2 space-y-1">
              {invalidFields.map(({ name, label }) => (
                <li key={name}>
                  <a
                    href={`#${fieldId(name)}`}
                    onClick={(event) => {
                      event.preventDefault()
                      document.getElementById(fieldId(name))?.focus()
                    }}
                    className="text-sm font-medium text-red-800 underline underline-offset-2 hover:text-red-900"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{serverError}</span>
          </div>
        )}

        <div className="space-y-2.5 pt-1">
          {/* WEEMAP takes a request and confirms availability afterwards. Saying
              so before the button — not only in the success panel — is what the
              other request forms already do. */}
          <p className="rounded-xl border border-sand-300 bg-sand-100 p-3 text-xs leading-relaxed text-ink-muted">
            {forms('requestNotice')}
          </p>

          {!allocationComplete && (
            <p id="booking-allocation-hint" className="text-xs font-medium text-sun-700">
              {forms('completeAllocation')}
            </p>
          )}

          <Button
            type="submit"
            // aria-disabled rather than disabled: a disabled button is skipped by
            // the keyboard entirely, so the visitor never reaches the reason. The
            // submit handler is the thing that actually blocks.
            aria-disabled={submitting || !allocationComplete}
            aria-busy={submitting}
            aria-describedby={!allocationComplete ? 'booking-allocation-hint' : undefined}
            onClick={(event) => {
              if (submitting || !allocationComplete) event.preventDefault()
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-500 text-base font-semibold text-on-accent transition-colors hover:bg-sun-600 disabled:cursor-not-allowed disabled:bg-sand-300 disabled:text-ink-subtle"
          >
            {submitting
              ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              : <Send className="h-4 w-4 rtl:-scale-x-100" aria-hidden />}
            {submitting ? forms('sending') : t('submit')}
          </Button>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener"
            onClick={() => trackConversion('whatsapp_click', { source: 'book_dahab', content_type: 'accommodation' }, { once: false })}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-[#128C4A] font-semibold text-[#0F7A40] transition-colors hover:bg-[#25D366]/15"
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
            <div className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
              {t('priceBreakdown')}
            </div>

            {mode === 'package' && packageQuote && (
              <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sun-50 px-3 py-1 text-xs font-semibold text-sun-700">
                ✓ {t('includedTripsBadge')}
              </div>
            )}

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
                  {selectedPackages.length > 0 && (
                    <>
                      {selectedPackages.map((pkg) => (
                        <Line
                          key={pkg.id}
                          label={ar ? pkg.name_ar : pkg.name_en}
                          value={`${formatEGP(pkg.totals?.packageTotal ?? 0, locale)} ${common('egp')}`}
                        />
                      ))}
                      <Line
                        label={ar ? 'إجمالي باقات الرحلات' : 'Trip Packages total'}
                        value={`${formatEGP(packagesSubtotal, locale)} ${common('egp')}`}
                      />
                    </>
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
              <div className="text-xs text-ink-subtle">
                {t('totalFor')} {numPeople} {numPeople === 1 ? common('person') : common('people')}
              </div>
              <div className="font-display text-3xl font-bold text-sea-900">
                {formatEGP(total, locale)}{' '}
                <span className="text-base font-semibold text-ink-muted">{common('egp')}</span>
              </div>
            </div>

            <p className="mt-2 text-[0.7rem] leading-relaxed text-ink-subtle">
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
      <span className="text-ink-muted">{label}</span>
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
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        'flex items-start gap-3 rounded-2xl border-[1.5px] p-4 text-start transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700',
        active
          ? 'border-sun-600 bg-sun-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-sun-500 text-on-accent' : 'bg-sand-100 text-sea-700',
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-sea-900">{title}</span>
        <span className="mt-0.5 block text-xs text-ink-subtle">{desc}</span>
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
        active ? 'border-sun-600 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-sea-600' : 'text-ink-subtle')} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-sea-900">{title}</span>
        <span className="mt-0.5 block text-[0.7rem] leading-snug text-ink-subtle">{desc}</span>
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
        active ? 'border-sun-600 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span className="text-sm font-medium text-sea-900">{ar ? plan.label_ar : plan.label_en}</span>
      <span className="shrink-0 text-xs font-semibold text-sea-600">
        {plan.price_per_person_per_night > 0 ? `+${formatAmount(plan.price_per_person_per_night, ar ? 'ar' : 'en')}` : (ar ? 'مجاني' : 'Free')}
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
        selected ? 'border-sun-600 bg-sun-50' : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <span className="text-sm font-medium text-sea-900">{label}</span>
      {extra && (
        <span className="shrink-0 text-xs font-semibold text-sun-700">{extra}</span>
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
          ? 'border-sun-600 bg-sun-50'
          : 'border-sea-100 hover:border-sea-300',
      )}
    >
      <div className="text-sm font-semibold text-sea-900">{title}</div>
      <div className="mt-1 text-xs leading-snug text-ink-muted">{desc}</div>
    </button>
  )
}
