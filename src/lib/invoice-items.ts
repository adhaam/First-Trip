// ─── Invoice line items ───
//
// Pure builders that turn a booking row into the charge lines and the
// "what did I book" facts an invoice shows. Kept out of the route so the
// branching can be tested directly — it is the part that was wrong.
//
// The bug being fixed: line items used to be derived from price_snapshot
// alone and, when that was absent (every manually-entered booking, because
// the admin route never built one), a single line labelled "Accommodation"
// with qty = num_people was emitted. A 5-person transfer-only booking
// therefore printed as an accommodation charge for a hotel it never had.
//
// Two rules hold here:
//   1. A booking is described by its booking_type. A transfer-only invoice
//      never names an accommodation; an accommodation-only one never invents
//      a transfer.
//   2. The snapshot is preferred when present (it is the frozen truth), but
//      its absence degrades to the booking's own columns rather than to a
//      misleading placeholder. Old rows still produce a correct invoice.

import type { InvoiceData, InvoiceDetail } from './invoice-generator'
import type { Booking, PriceSnapshot, TripBookingPriceSnapshot } from './types'

type InvoiceItem = InvoiceData['items'][number]

const TRANSFER_LABELS = {
  hiace: { ar: 'هايس خاص', en: 'Private Hiace' },
  package_bus: { ar: 'باص جماعي', en: 'Shared bus' },
} as const

const DIRECTION_LABELS = {
  to_dahab: { ar: 'ذهاب إلى دهب', en: 'To Dahab' },
  from_dahab: { ar: 'عودة من دهب', en: 'From Dahab' },
  round_trip: { ar: 'ذهاب وعودة', en: 'Round trip' },
} as const

const ROOM_LABELS = {
  single: { ar: 'غرفة مفردة', en: 'Single room' },
  double: { ar: 'غرفة مزدوجة', en: 'Double room' },
  triple: { ar: 'غرفة ثلاثية', en: 'Triple room' },
} as const

const BOOKING_TYPE_LABELS = {
  'package': { ar: 'باقة كاملة (إقامة + انتقالات)', en: 'Full package (stay + transfer)' },
  'accommodation-only': { ar: 'إقامة فقط', en: 'Accommodation only' },
  'transfer-only': { ar: 'انتقالات فقط', en: 'Transfer only' },
} as const

const MEAL_PLAN_LABELS: Record<string, { ar: string; en: string }> = {
  room_only: { ar: 'غرفة فقط', en: 'Room only' },
  breakfast: { ar: 'إفطار', en: 'Breakfast' },
  half_board: { ar: 'نصف إقامة', en: 'Half board' },
  all_inclusive: { ar: 'شامل كلياً', en: 'All inclusive' },
}

function detail(
  label_ar: string, label_en: string, value_ar: string, value_en: string,
): InvoiceDetail {
  return { label_ar, label_en, value_ar, value_en }
}

function peopleLabel(n: number) {
  return {
    ar: `${n} ${n === 1 ? 'فرد' : 'أفراد'}`,
    en: `${n} ${n === 1 ? 'person' : 'people'}`,
  }
}

function nightsText(n: number) {
  return { ar: `${n} ${n === 1 ? 'ليلة' : 'ليالي'}`, en: `${n} night${n === 1 ? '' : 's'}` }
}

function formatDate(value: string | null | undefined, locale: 'ar' | 'en'): string | null {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-US')
}

/**
 * Build the charge lines + booking facts for a `bookings` row, branching on
 * booking_type so each invoice only ever describes what was actually booked.
 */
export function buildAccommodationInvoice(
  booking: Booking & { accommodations: { name_ar: string; name_en: string } | null },
  locale: 'ar' | 'en',
): { items: InvoiceItem[]; details: InvoiceDetail[]; discount?: InvoiceData['discount'] } {
  const snapshot: PriceSnapshot | null = booking.price_snapshot ?? null
  const numPeople = booking.num_people || 1
  const ppl = peopleLabel(numPeople)
  const items: InvoiceItem[] = []
  const details: InvoiceDetail[] = []

  // ─── Facts every booking has ───
  const typeLabel = BOOKING_TYPE_LABELS[booking.booking_type] ?? BOOKING_TYPE_LABELS['package']
  details.push(detail('نوع الحجز', 'Booking type', typeLabel.ar, typeLabel.en))
  details.push(detail('عدد الأفراد', 'Number of people', ppl.ar, ppl.en))

  const tripDate = formatDate(booking.trip_date, locale)
  if (tripDate) details.push(detail('تاريخ الذهاب', 'Trip date', tripDate, tripDate))
  const returnDate = formatDate(booking.return_date, locale)
  if (returnDate) details.push(detail('تاريخ العودة', 'Return date', returnDate, returnDate))

  const isTransferOnly = booking.booking_type === 'transfer-only'

  // ─── Accommodation facts + line ───
  if (!isTransferOnly) {
    const accAr = booking.accommodations?.name_ar
    const accEn = booking.accommodations?.name_en
    if (accAr || accEn) {
      details.push(detail('الإقامة', 'Accommodation', accAr || accEn || '—', accEn || accAr || '—'))
    }

    const roomType = snapshot?.room_type || booking.room_type
    if (roomType && ROOM_LABELS[roomType]) {
      const numRooms = snapshot?.num_rooms
      details.push(detail(
        'نوع الغرفة', 'Room type',
        numRooms && numRooms > 1 ? `${numRooms} × ${ROOM_LABELS[roomType].ar}` : ROOM_LABELS[roomType].ar,
        numRooms && numRooms > 1 ? `${numRooms} × ${ROOM_LABELS[roomType].en}` : ROOM_LABELS[roomType].en,
      ))
    }

    const nights = snapshot?.nights ?? booking.nights
    if (nights) {
      const n = nightsText(nights)
      details.push(detail('عدد الليالي', 'Nights', n.ar, n.en))
    }

    if (booking.meal_plan_key) {
      const meal = MEAL_PLAN_LABELS[booking.meal_plan_key]
        ?? { ar: booking.meal_plan_key, en: booking.meal_plan_key }
      details.push(detail('خطة الوجبات', 'Meal plan', meal.ar, meal.en))
    }

    const accSubtotal = snapshot?.accommodation_subtotal
    if (accSubtotal && accSubtotal > 0) {
      const nightsLabel = nights ? nightsText(nights) : null
      items.push({
        description_ar: `الإقامة${booking.accommodations?.name_ar ? ` — ${booking.accommodations.name_ar}` : ''}`,
        description_en: `Accommodation${booking.accommodations?.name_en ? ` — ${booking.accommodations.name_en}` : ''}`,
        quantity: 1,
        unitPrice: accSubtotal,
        meta_ar: [
          snapshot?.num_rooms ? `${snapshot.num_rooms} ${snapshot.num_rooms === 1 ? 'غرفة' : 'غرف'}` : null,
          nightsLabel?.ar,
        ].filter(Boolean).join(' × ') || undefined,
        meta_en: [
          snapshot?.num_rooms ? `${snapshot.num_rooms} room${snapshot.num_rooms === 1 ? '' : 's'}` : null,
          nightsLabel?.en,
        ].filter(Boolean).join(' × ') || undefined,
      })
    }
  }

  // ─── Transfer facts + line ───
  if (isTransferOnly || booking.booking_type === 'package') {
    if (booking.transfer_type) {
      const t = TRANSFER_LABELS[booking.transfer_type]
      details.push(detail('نوع الانتقال', 'Transfer type', t.ar, t.en))
    }
    if (booking.transfer_direction) {
      const d = DIRECTION_LABELS[booking.transfer_direction]
      details.push(detail('اتجاه الرحلة', 'Direction', d.ar, d.en))
    }
    if (booking.governorate) {
      details.push(detail('المحافظة', 'Governorate', booking.governorate, booking.governorate))
    }

    const transferSubtotal = snapshot?.transfer_subtotal
    if (transferSubtotal && transferSubtotal > 0) {
      const perPerson = snapshot?.transfer_rate_used
      const tLabel = booking.transfer_type ? TRANSFER_LABELS[booking.transfer_type] : null
      const dLabel = booking.transfer_direction ? DIRECTION_LABELS[booking.transfer_direction] : null
      items.push({
        description_ar: `الانتقالات${tLabel ? ` — ${tLabel.ar}` : ''}${dLabel ? ` (${dLabel.ar})` : ''}`,
        description_en: `Transfer${tLabel ? ` — ${tLabel.en}` : ''}${dLabel ? ` (${dLabel.en})` : ''}`,
        // Priced per person, so the quantity column finally means something.
        quantity: numPeople,
        unitPrice: perPerson && perPerson > 0 ? perPerson : transferSubtotal / numPeople,
        meta_ar: perPerson ? `${ppl.ar} × ${perPerson.toLocaleString('en-US')} ج.م` : undefined,
        meta_en: perPerson ? `${ppl.en} × ${perPerson.toLocaleString('en-US')} EGP` : undefined,
      })
    }
  }

  // ─── Meals, trips, packages ───
  if (snapshot?.meal_subtotal && snapshot.meal_subtotal > 0) {
    const perNight = snapshot.meal_plan_price_per_person_per_night
    const nights = snapshot.nights
    items.push({
      description_ar: 'خطة الوجبات',
      description_en: 'Meal plan',
      quantity: 1,
      unitPrice: snapshot.meal_subtotal,
      meta_ar: perNight && nights ? `${ppl.ar} × ${nightsText(nights).ar} × ${perNight.toLocaleString('en-US')} ج.م` : undefined,
      meta_en: perNight && nights ? `${ppl.en} × ${nightsText(nights).en} × ${perNight.toLocaleString('en-US')} EGP` : undefined,
    })
  }

  if (snapshot?.included_trips_subtotal && snapshot.included_trips_subtotal > 0) {
    items.push({
      description_ar: 'الرحلات المضمنة',
      description_en: 'Included trips',
      quantity: 1,
      unitPrice: snapshot.included_trips_subtotal,
    })
  }

  // Extra trips are itemised individually so a discount on one of them is
  // visible instead of being buried in a single subtotal.
  let extraTripsDiscount = 0
  if (snapshot?.extra_trips && snapshot.extra_trips.length > 0) {
    for (const trip of snapshot.extra_trips) {
      const before = trip.price_before_discount
      const off = trip.discount_per_person ?? 0
      extraTripsDiscount += off * numPeople
      items.push({
        description_ar: `رحلة إضافية — ${trip.name_en}`,
        description_en: `Extra trip — ${trip.name_en}`,
        quantity: numPeople,
        unitPrice: trip.price,
        meta_ar: before
          ? `السعر الأصلي ${before.toLocaleString('en-US')} ج.م — بعد الخصم ${trip.price.toLocaleString('en-US')} ج.م للفرد`
          : undefined,
        meta_en: before
          ? `Was ${before.toLocaleString('en-US')} EGP — ${trip.price.toLocaleString('en-US')} EGP per person after discount`
          : undefined,
      })
    }
  } else if (snapshot?.extra_trips_subtotal && snapshot.extra_trips_subtotal > 0) {
    items.push({
      description_ar: 'رحلات إضافية',
      description_en: 'Extra trips',
      quantity: 1,
      unitPrice: snapshot.extra_trips_subtotal,
    })
  }

  if (snapshot?.trip_packages && snapshot.trip_packages.length > 0) {
    for (const pkg of snapshot.trip_packages) {
      items.push({
        description_ar: `باقة رحلات — ${pkg.name_en}`,
        description_en: `Trip package — ${pkg.name_en}`,
        quantity: 1,
        unitPrice: pkg.total,
        meta_ar: pkg.trip_names_en.length ? pkg.trip_names_en.join(' + ') : undefined,
        meta_en: pkg.trip_names_en.length ? pkg.trip_names_en.join(' + ') : undefined,
      })
    }
  } else if (snapshot?.trip_packages_subtotal && snapshot.trip_packages_subtotal > 0) {
    items.push({
      description_ar: 'باقات الرحلات',
      description_en: 'Trip packages',
      quantity: 1,
      unitPrice: snapshot.trip_packages_subtotal,
    })
  }

  // ─── Fallback for rows with no snapshot at all ───
  //
  // Pre-dates the manual-booking pricing work. It still describes the booking
  // honestly: it names what was booked from booking_type, and never claims an
  // accommodation charge on a transfer-only booking.
  if (items.length === 0) {
    const total = booking.total_price || 0
    if (isTransferOnly) {
      const tLabel = booking.transfer_type ? TRANSFER_LABELS[booking.transfer_type] : null
      const dLabel = booking.transfer_direction ? DIRECTION_LABELS[booking.transfer_direction] : null
      items.push({
        description_ar: `الانتقالات${tLabel ? ` — ${tLabel.ar}` : ''}${dLabel ? ` (${dLabel.ar})` : ''}`,
        description_en: `Transfer${tLabel ? ` — ${tLabel.en}` : ''}${dLabel ? ` (${dLabel.en})` : ''}`,
        quantity: numPeople,
        unitPrice: total / numPeople,
        meta_ar: `${ppl.ar} × ${(total / numPeople).toLocaleString('en-US')} ج.م`,
        meta_en: `${ppl.en} × ${(total / numPeople).toLocaleString('en-US')} EGP`,
      })
    } else {
      const label = BOOKING_TYPE_LABELS[booking.booking_type] ?? BOOKING_TYPE_LABELS['package']
      const accAr = booking.accommodations?.name_ar
      const accEn = booking.accommodations?.name_en
      items.push({
        description_ar: accAr ? `${label.ar} — ${accAr}` : label.ar,
        description_en: accEn ? `${label.en} — ${accEn}` : label.en,
        quantity: numPeople,
        unitPrice: total / numPeople,
        meta_ar: `${ppl.ar} × ${(total / numPeople).toLocaleString('en-US')} ج.م`,
        meta_en: `${ppl.en} × ${(total / numPeople).toLocaleString('en-US')} EGP`,
      })
    }
  }

  // An admin override is shown as an explicit adjustment rather than being
  // folded into the numbers, so the customer's total still ties to the lines.
  let discount: InvoiceData['discount']
  if (snapshot?.price_override && snapshot.computed_total !== undefined) {
    const off = snapshot.computed_total - (booking.total_price ?? snapshot.total)
    if (off > 0) {
      discount = { label_ar: 'خصم', label_en: 'Discount', amount: off }
    }
  } else if (extraTripsDiscount > 0) {
    discount = { label_ar: 'خصم الرحلات', label_en: 'Trip discount', amount: extraTripsDiscount }
  }

  return { items, details, discount }
}

interface TripBookingRow {
  num_people: number
  preferred_date: string | null
  quoted_price: number | null
  final_price: number | null
  trip_package_id: string | null
  price_snapshot: TripBookingPriceSnapshot | null
  package_snapshot: {
    name_ar?: string
    name_en?: string
    package_total?: number
    trips?: { name_ar?: string; name_en?: string }[]
  } | null
  sinai_trips: { name_ar: string; name_en: string } | null
  trip_packages: { name_ar: string; name_en: string } | null
}

/**
 * Sinai trip / trip-package bookings. A package booking previously fell
 * through to the generic "Sinai Trip" label because only sinai_trips was
 * read — package_snapshot holds the real name and contents.
 */
export function buildTripInvoice(
  booking: TripBookingRow,
  locale: 'ar' | 'en',
): { items: InvoiceItem[]; details: InvoiceDetail[]; discount?: InvoiceData['discount'] } {
  const numPeople = booking.num_people || 1
  const ppl = peopleLabel(numPeople)
  const snapshot = booking.price_snapshot
  const details: InvoiceDetail[] = []
  const items: InvoiceItem[] = []

  const isPackage = Boolean(booking.trip_package_id)
  details.push(detail(
    'نوع الحجز', 'Booking type',
    isPackage ? 'باقة رحلات' : 'رحلة سيناء',
    isPackage ? 'Trip package' : 'Sinai trip',
  ))
  details.push(detail('عدد الأفراد', 'Number of people', ppl.ar, ppl.en))

  const date = formatDate(booking.preferred_date, locale)
  if (date) details.push(detail('التاريخ المفضل', 'Preferred date', date, date))

  if (isPackage) {
    const nameAr = booking.package_snapshot?.name_ar || booking.trip_packages?.name_ar || 'باقة رحلات'
    const nameEn = booking.package_snapshot?.name_en || booking.trip_packages?.name_en || 'Trip package'
    details.push(detail('الباقة', 'Package', nameAr, nameEn))

    const tripNames = booking.package_snapshot?.trips || []
    if (tripNames.length > 0) {
      details.push(detail(
        'الرحلات المشمولة', 'Included trips',
        tripNames.map(t => t.name_ar || t.name_en || '').filter(Boolean).join('، '),
        tripNames.map(t => t.name_en || t.name_ar || '').filter(Boolean).join(', '),
      ))
    }

    const perPerson = booking.package_snapshot?.package_total
    const total = booking.final_price ?? booking.quoted_price ?? 0
    items.push({
      description_ar: `باقة رحلات — ${nameAr}`,
      description_en: `Trip package — ${nameEn}`,
      quantity: numPeople,
      unitPrice: perPerson && perPerson > 0 ? perPerson : total / numPeople,
      meta_ar: tripNames.length
        ? tripNames.map(t => t.name_ar || t.name_en).filter(Boolean).join(' + ')
        : undefined,
      meta_en: tripNames.length
        ? tripNames.map(t => t.name_en || t.name_ar).filter(Boolean).join(' + ')
        : undefined,
    })
    return { items, details }
  }

  const nameAr = booking.sinai_trips?.name_ar || 'رحلة سيناء'
  const nameEn = booking.sinai_trips?.name_en || 'Sinai Trip'
  details.push(detail('الرحلة', 'Trip', nameAr, nameEn))

  const total = booking.final_price ?? booking.quoted_price ?? 0
  const unitPrice = snapshot?.unit_price ?? (numPeople ? total / numPeople : total)
  const before = snapshot?.unit_price_before_discount

  items.push({
    description_ar: nameAr,
    description_en: nameEn,
    quantity: numPeople,
    unitPrice,
    meta_ar: `${ppl.ar} × ${unitPrice.toLocaleString('en-US')} ج.م`,
    meta_en: `${ppl.en} × ${unitPrice.toLocaleString('en-US')} EGP`,
  })

  let discount: InvoiceData['discount']
  if (snapshot?.discount_per_person && snapshot.discount_per_person > 0 && before) {
    discount = {
      label_ar: snapshot.discount_type === 'percentage' ? `خصم ${snapshot.discount_value}%` : 'خصم',
      label_en: snapshot.discount_type === 'percentage' ? `Discount ${snapshot.discount_value}%` : 'Discount',
      amount: snapshot.discount_per_person * numPeople,
    }
    // The line above already charges the discounted unit price, so show the
    // pre-discount figure as context rather than double-deducting.
    items[items.length - 1].unitPrice = before
    items[items.length - 1].meta_ar = `${ppl.ar} × ${before.toLocaleString('en-US')} ج.م`
    items[items.length - 1].meta_en = `${ppl.en} × ${before.toLocaleString('en-US')} EGP`
  }

  return { items, details, discount }
}
