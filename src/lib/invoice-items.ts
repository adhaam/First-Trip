// ─── Invoice line items ───
//
// Pure builders that turn a booking row into everything an invoice shows:
// the charge lines, the "what did I book" facts, the summary adjustments,
// the total and the invoice number. Kept out of the route so the branching
// can be tested directly, and so the invoice is provably a function of the
// booking row alone — nothing here reads a catalogue price.
//
// The rules held here:
//   1. A booking is described by its booking_type. A transfer-only invoice
//      never names an accommodation; an accommodation-only one never invents
//      a transfer.
//   2. The frozen price_snapshot is the base truth for the lines. Live
//      catalogue prices (accommodations / sinai_trips price columns) are
//      never read — a price change today must not rewrite an old invoice.
//   3. The lines always reconcile EXACTLY to the displayed total:
//          subtotal (Σ lines) + Σ adjustments === totalAmount
//      When the booking's live agreed total (total_price / final_price, set
//      by staff) differs from what the snapshot itemises, the difference is
//      an explicit, labelled "Agreed price adjustment" row — never a total
//      the lines silently fail to add up to.
//   4. No snapshot (legacy rows) → one honest line carrying the stored total,
//      not an invented per-person breakdown.
//   5. The invoice number is derived from immutable booking data, so the
//      same booking renders the same number every time.

import type { InvoiceAdjustment, InvoiceData, InvoiceDetail } from './invoice-generator'
import type { Booking, PriceSnapshot, SiteSettings, TripBookingPriceSnapshot } from './types'

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

/** Staff set a total different from the itemised one (override, final_price, manual edit). */
export const AGREED_ADJUSTMENT_LABEL = {
  label_ar: 'تعديل السعر المتفق عليه',
  label_en: 'Agreed price adjustment',
} as const

/**
 * The snapshot's own components do not add up to the snapshot's total (an
 * older snapshot shape this builder cannot fully itemise). Shown rather than
 * hidden so the lines still reconcile.
 */
export const PRICING_ADJUSTMENT_LABEL = {
  label_ar: 'تسوية التسعير',
  label_en: 'Pricing adjustment',
} as const

// ─── Small pure helpers ───

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100
const isNum = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n)
const egp = (n: number) => n.toLocaleString('en-US')

/** A DB numeric that may arrive as number, numeric string or null. */
function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
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

export function lineTotal(item: InvoiceItem): number {
  return round2(item.quantity * item.unitPrice)
}

export function sumLines(items: InvoiceItem[]): number {
  return round2(items.reduce((s, i) => s + lineTotal(i), 0))
}

function sumAdjustments(adjustments: InvoiceAdjustment[]): number {
  return round2(adjustments.reduce((s, a) => s + a.amount, 0))
}

/**
 * A per-person line when `perPerson × people` really is the frozen subtotal,
 * otherwise a single lump line for the subtotal — a line must never display
 * an amount other than the one that was charged.
 */
function perPersonLine(
  base: Pick<InvoiceItem, 'description_ar' | 'description_en'>,
  subtotal: number,
  perPerson: number | undefined,
  people: number,
): InvoiceItem {
  const ppl = peopleLabel(people)
  if (isNum(perPerson) && perPerson > 0 && round2(perPerson * people) === round2(subtotal)) {
    return {
      ...base,
      quantity: people,
      unitPrice: perPerson,
      meta_ar: `${ppl.ar} × ${egp(perPerson)} ج.م`,
      meta_en: `${ppl.en} × ${egp(perPerson)} EGP`,
    }
  }
  return { ...base, quantity: 1, unitPrice: subtotal, meta_ar: ppl.ar, meta_en: ppl.en }
}

/**
 * Close the gap between what the lines itemise and the displayed total with
 * explicit, labelled rows. `reference` is what the snapshot's components are
 * supposed to add up to (null when there is no such figure); `target` is the
 * total the invoice displays.
 */
function reconcile(
  items: InvoiceItem[],
  adjustments: InvoiceAdjustment[],
  reference: number | null,
  target: number,
): Pick<BuiltInvoice, 'subtotal' | 'adjustments' | 'totalAmount' | 'discount'> {
  const out = [...adjustments]
  const subtotal = sumLines(items)
  let net = round2(subtotal + sumAdjustments(out))

  if (reference !== null) {
    const gap = round2(reference - net)
    if (Math.abs(gap) >= 0.01) out.push({ ...PRICING_ADJUSTMENT_LABEL, amount: gap })
    net = round2(reference)
  }

  const agreed = round2(target - net)
  if (Math.abs(agreed) >= 0.01) out.push({ ...AGREED_ADJUSTMENT_LABEL, amount: agreed })

  const firstDeduction = out.find((adjustment) => adjustment.amount < 0)
  return {
    subtotal,
    adjustments: out,
    totalAmount: round2(target),
    discount: firstDeduction
      ? {
          label_ar: firstDeduction.label_ar,
          label_en: firstDeduction.label_en,
          amount: Math.abs(firstDeduction.amount),
        }
      : undefined,
  }
}

export interface BuiltInvoice {
  items: InvoiceItem[]
  details: InvoiceDetail[]
  /** Compatibility view of the first deduction; new rendering uses adjustments. */
  discount?: InvoiceData['discount']
  /** Signed rows between subtotal and total; see InvoiceData.adjustments. */
  adjustments: InvoiceAdjustment[]
  /** Σ line totals. */
  subtotal: number
  /** subtotal + Σ adjustments — what the invoice says is owed. */
  totalAmount: number
}

// ─── Stable invoice number ───

/**
 * Deterministic: prefix + booking creation date (UTC) + id fragment + stage.
 * Re-rendering the same booking always yields the same number — the old
 * `…-<Date.now()>` suffix meant a reprint looked like a different invoice.
 */
export function buildInvoiceNumber(
  prefix: 'BK' | 'TB',
  bookingId: string,
  createdAt: string | null | undefined,
  type: 'request' | 'confirmation',
): string {
  const d = createdAt ? new Date(createdAt) : null
  const date = d && !Number.isNaN(d.getTime())
    ? d.toISOString().slice(0, 10).replace(/-/g, '')
    : '00000000'
  const idPart = String(bookingId).replace(/[^0-9a-zA-Z]/g, '').slice(0, 8).toUpperCase()
  return `${prefix}-${date}-${idPart}-${type === 'request' ? 'REQ' : 'CONF'}`
}

// ─── Accommodation / package / transfer bookings (`bookings` table) ───

export type AccommodationInvoiceRow = Booking & {
  accommodations: { name_ar: string; name_en: string } | null
}

/**
 * Room-upgrade lines recorded in room_allocations. Historical public-route
 * snapshots froze accommodation_subtotal WITHOUT the upgrade (while `total`
 * included it); computeQuote / multi-room snapshots fold it IN. Which shape a
 * row has is decided by reconciling against the snapshot's total — see
 * buildAccommodationInvoice.
 */
function upgradeLines(snapshot: PriceSnapshot): InvoiceItem[] {
  const nights = snapshot.nights
  if (!isNum(nights) || nights <= 0 || !Array.isArray(snapshot.room_allocations)) return []
  const lines: InvoiceItem[] = []
  for (const alloc of snapshot.room_allocations) {
    const extra = Number(alloc.upgrade_extra_per_night) || 0
    const rooms = Math.max(1, Number(alloc.quantity) || 1)
    if (extra <= 0) continue
    const name = alloc.upgrade_name ? ` — ${alloc.upgrade_name}` : ''
    const n = nightsText(nights)
    lines.push({
      description_ar: `ترقية الغرفة${name}`,
      description_en: `Room upgrade${name}`,
      quantity: 1,
      unitPrice: round2(extra * rooms * nights),
      meta_ar: `${rooms} ${rooms === 1 ? 'غرفة' : 'غرف'} × ${n.ar} × ${egp(extra)} ج.م`,
      meta_en: `${rooms} room${rooms === 1 ? '' : 's'} × ${n.en} × ${egp(extra)} EGP`,
    })
  }
  return lines
}

/**
 * Build the charge lines + booking facts for a `bookings` row, branching on
 * booking_type so each invoice only ever describes what was actually booked.
 */
export function buildAccommodationInvoice(
  booking: AccommodationInvoiceRow,
  locale: 'ar' | 'en',
): BuiltInvoice {
  const snapshot: PriceSnapshot | null = booking.price_snapshot ?? null
  const numPeople = booking.num_people || 1
  const ppl = peopleLabel(numPeople)
  // Frozen party size for snapshot-derived per-person lines.
  const snapPeople = (snapshot && isNum(snapshot.num_people) && snapshot.num_people > 0)
    ? snapshot.num_people
    : numPeople
  const items: InvoiceItem[] = []
  const details: InvoiceDetail[] = []
  const adjustments: InvoiceAdjustment[] = []

  // ─── Facts every booking has ───
  const typeLabel = BOOKING_TYPE_LABELS[booking.booking_type] ?? BOOKING_TYPE_LABELS['package']
  details.push(detail('نوع الحجز', 'Booking type', typeLabel.ar, typeLabel.en))
  details.push(detail('عدد الأفراد', 'Number of people', ppl.ar, ppl.en))

  const tripDate = formatDate(booking.trip_date, locale)
  if (tripDate) details.push(detail('تاريخ الذهاب', 'Trip date', tripDate, tripDate))
  const returnDate = formatDate(booking.return_date, locale)
  if (returnDate) details.push(detail('تاريخ العودة', 'Return date', returnDate, returnDate))

  const isTransferOnly = booking.booking_type === 'transfer-only'
  let accommodationLineIndex = -1

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
    if (isNum(accSubtotal) && accSubtotal > 0) {
      const nightsLabel = nights ? nightsText(nights) : null
      accommodationLineIndex = items.length
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
    if (booking.transfer_type && TRANSFER_LABELS[booking.transfer_type]) {
      const t = TRANSFER_LABELS[booking.transfer_type]
      details.push(detail('نوع الانتقال', 'Transfer type', t.ar, t.en))
    }
    if (booking.transfer_direction && DIRECTION_LABELS[booking.transfer_direction]) {
      const d = DIRECTION_LABELS[booking.transfer_direction]
      details.push(detail('اتجاه الرحلة', 'Direction', d.ar, d.en))
    }
    if (booking.governorate) {
      details.push(detail('المحافظة', 'Governorate', booking.governorate, booking.governorate))
    }

    const transferSubtotal = snapshot?.transfer_subtotal
    if (isNum(transferSubtotal) && transferSubtotal > 0) {
      const tLabel = booking.transfer_type ? TRANSFER_LABELS[booking.transfer_type] : null
      const dLabel = booking.transfer_direction ? DIRECTION_LABELS[booking.transfer_direction] : null
      items.push(perPersonLine({
        description_ar: `الانتقالات${tLabel ? ` — ${tLabel.ar}` : ''}${dLabel ? ` (${dLabel.ar})` : ''}`,
        description_en: `Transfer${tLabel ? ` — ${tLabel.en}` : ''}${dLabel ? ` (${dLabel.en})` : ''}`,
      }, transferSubtotal, snapshot?.transfer_rate_used, snapPeople))
    }
  }

  // ─── Meals, trips, packages ───
  if (snapshot && isNum(snapshot.meal_subtotal) && snapshot.meal_subtotal > 0) {
    const perNight = snapshot.meal_plan_price_per_person_per_night
    const nights = snapshot.nights
    const sp = peopleLabel(snapPeople)
    items.push({
      description_ar: 'خطة الوجبات',
      description_en: 'Meal plan',
      quantity: 1,
      unitPrice: snapshot.meal_subtotal,
      meta_ar: perNight && nights ? `${sp.ar} × ${nightsText(nights).ar} × ${egp(perNight)} ج.م` : undefined,
      meta_en: perNight && nights ? `${sp.en} × ${nightsText(nights).en} × ${egp(perNight)} EGP` : undefined,
    })
  }

  if (snapshot && isNum(snapshot.included_trips_subtotal) && snapshot.included_trips_subtotal > 0) {
    items.push({
      description_ar: 'الرحلات المضمنة',
      description_en: 'Included trips',
      quantity: 1,
      unitPrice: snapshot.included_trips_subtotal,
    })
  }

  // Extra trips are itemised individually at their PRE-discount price, with
  // the saving as its own deducted row. `trip.price` is already the
  // post-discount figure, so the line must not use it AND deduct the
  // discount again (the old double subtraction).
  if (snapshot?.extra_trips && snapshot.extra_trips.length > 0) {
    let tripDiscount = 0
    const sp = peopleLabel(snapPeople)
    for (const trip of snapshot.extra_trips) {
      const off = Number(trip.discount_per_person) || 0
      const gross = off > 0 && isNum(trip.price_before_discount) ? trip.price_before_discount : trip.price
      if (off > 0 && isNum(trip.price_before_discount)) tripDiscount += off * snapPeople
      items.push({
        description_ar: `رحلة إضافية — ${trip.name_en}`,
        description_en: `Extra trip — ${trip.name_en}`,
        quantity: snapPeople,
        unitPrice: gross,
        meta_ar: `${sp.ar} × ${egp(gross)} ج.م`,
        meta_en: `${sp.en} × ${egp(gross)} EGP`,
      })
    }
    if (tripDiscount > 0) {
      adjustments.push({ label_ar: 'خصم الرحلات', label_en: 'Trip discount', amount: -round2(tripDiscount) })
    }
  } else if (snapshot && isNum(snapshot.extra_trips_subtotal) && snapshot.extra_trips_subtotal > 0) {
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
        meta_ar: pkg.trip_names_en?.length ? pkg.trip_names_en.join(' + ') : undefined,
        meta_en: pkg.trip_names_en?.length ? pkg.trip_names_en.join(' + ') : undefined,
      })
    }
  } else if (snapshot && isNum(snapshot.trip_packages_subtotal) && snapshot.trip_packages_subtotal > 0) {
    items.push({
      description_ar: 'باقات الرحلات',
      description_en: 'Trip packages',
      quantity: 1,
      unitPrice: snapshot.trip_packages_subtotal,
    })
  }

  // The live, staff-editable agreed total. Null on unpriced legacy rows.
  const storedTotal = num(booking.total_price)

  // ─── No usable snapshot (legacy rows) ───
  //
  // One honest line carrying the stored total. It names what was booked from
  // booking_type and never claims an accommodation charge on a transfer-only
  // booking — but it does not invent a per-person split nobody agreed to.
  if (items.length === 0) {
    const total = storedTotal ?? (snapshot && isNum(snapshot.total) ? snapshot.total : 0)
    let description_ar: string
    let description_en: string
    if (isTransferOnly) {
      const tLabel = booking.transfer_type ? TRANSFER_LABELS[booking.transfer_type] : null
      const dLabel = booking.transfer_direction ? DIRECTION_LABELS[booking.transfer_direction] : null
      description_ar = `الانتقالات${tLabel ? ` — ${tLabel.ar}` : ''}${dLabel ? ` (${dLabel.ar})` : ''}`
      description_en = `Transfer${tLabel ? ` — ${tLabel.en}` : ''}${dLabel ? ` (${dLabel.en})` : ''}`
    } else {
      const label = BOOKING_TYPE_LABELS[booking.booking_type] ?? BOOKING_TYPE_LABELS['package']
      const accAr = booking.accommodations?.name_ar
      const accEn = booking.accommodations?.name_en
      description_ar = accAr ? `${label.ar} — ${accAr}` : label.ar
      description_en = accEn ? `${label.en} — ${accEn}` : label.en
    }
    const lines: InvoiceItem[] = [{
      description_ar, description_en, quantity: 1, unitPrice: total,
      meta_ar: ppl.ar, meta_en: ppl.en,
    }]
    return { items: lines, details, adjustments: [], subtotal: sumLines(lines), totalAmount: round2(total) }
  }

  // What the snapshot's components are meant to add up to: the engine's
  // figure when an admin overrode it (the override is then the agreed total).
  const reference = snapshot && snapshot.price_override && isNum(snapshot.computed_total)
    ? snapshot.computed_total
    : (snapshot && isNum(snapshot.total) ? snapshot.total : null)

  // Room upgrade: add its line only when the components are short by exactly
  // the upgrade amount (historical public shape). When accommodation_subtotal
  // already includes it (computeQuote / multi-room shape) it reconciles as-is.
  if (snapshot && reference !== null) {
    const ups = upgradeLines(snapshot)
    const upTotal = sumLines(ups)
    const net = round2(sumLines(items) + sumAdjustments(adjustments))
    if (upTotal > 0 && Math.abs(round2(reference - net)) >= 0.01 && Math.abs(round2(reference - net - upTotal)) < 0.01) {
      items.splice(accommodationLineIndex >= 0 ? accommodationLineIndex + 1 : 0, 0, ...ups)
    }
  }

  const target = storedTotal ?? (snapshot && isNum(snapshot.total) ? snapshot.total : sumLines(items))
  const rec = reconcile(items, adjustments, reference, target)
  return { items, details, ...rec }
}

// ─── Sinai trip / trip-package bookings (`trip_bookings` table) ───

export interface TripBookingRow {
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
 * Sinai trip / trip-package bookings. The displayed total is the staff-agreed
 * final_price when set, else the quoted_price; the frozen snapshot provides
 * the lines, and any difference is an explicit adjustment row.
 */
export function buildTripInvoice(
  booking: TripBookingRow,
  locale: 'ar' | 'en',
): BuiltInvoice {
  const numPeople = booking.num_people || 1
  const ppl = peopleLabel(numPeople)
  const snapshot = booking.price_snapshot
  const details: InvoiceDetail[] = []
  const items: InvoiceItem[] = []
  const adjustments: InvoiceAdjustment[] = []
  const agreedTotal = num(booking.final_price) ?? num(booking.quoted_price)

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

    const perPerson = num(booking.package_snapshot?.package_total)
    const base = {
      description_ar: `باقة رحلات — ${nameAr}`,
      description_en: `Trip package — ${nameEn}`,
    }
    const contents = tripNames.length
      ? {
          ar: tripNames.map(t => t.name_ar || t.name_en).filter(Boolean).join(' + '),
          en: tripNames.map(t => t.name_en || t.name_ar).filter(Boolean).join(' + '),
        }
      : null
    if (perPerson !== null && perPerson > 0) {
      // Frozen per-person bundle price × party; final_price, if staff set a
      // different figure, becomes the agreed adjustment below.
      items.push({
        ...base,
        quantity: numPeople,
        unitPrice: perPerson,
        meta_ar: contents?.ar,
        meta_en: contents?.en,
      })
      const target = agreedTotal ?? sumLines(items)
      return { items, details, ...reconcile(items, adjustments, null, target) }
    }
    // No frozen bundle price: one honest line for the stored total.
    const total = agreedTotal ?? 0
    items.push({ ...base, quantity: 1, unitPrice: total, meta_ar: contents?.ar ?? ppl.ar, meta_en: contents?.en ?? ppl.en })
    return { items, details, adjustments, subtotal: sumLines(items), totalAmount: round2(total) }
  }

  const nameAr = booking.sinai_trips?.name_ar || 'رحلة سيناء'
  const nameEn = booking.sinai_trips?.name_en || 'Sinai Trip'
  details.push(detail('الرحلة', 'Trip', nameAr, nameEn))

  if (!snapshot || num(snapshot.unit_price) === null) {
    // Legacy row with no frozen pricing: one line for the stored total.
    const total = agreedTotal ?? 0
    items.push({
      description_ar: nameAr, description_en: nameEn,
      quantity: 1, unitPrice: total, meta_ar: ppl.ar, meta_en: ppl.en,
    })
    return { items, details, adjustments, subtotal: sumLines(items), totalAmount: round2(total) }
  }

  const snapPeople = num(snapshot.num_people) && snapshot.num_people > 0 ? snapshot.num_people : numPeople
  const sp = peopleLabel(snapPeople)
  const off = Number(snapshot.discount_per_person) || 0
  const before = num(snapshot.unit_price_before_discount)
  // Charged at the pre-discount price, with the saving as its own row, so the
  // customer sees what the discount was worth — never both deducted.
  const gross = off > 0 && before !== null ? before : snapshot.unit_price
  items.push({
    description_ar: nameAr,
    description_en: nameEn,
    quantity: snapPeople,
    unitPrice: gross,
    meta_ar: `${sp.ar} × ${egp(gross)} ج.م`,
    meta_en: `${sp.en} × ${egp(gross)} EGP`,
  })
  if (off > 0 && before !== null) {
    adjustments.push({
      label_ar: snapshot.discount_type === 'percentage' ? `خصم ${snapshot.discount_value}%` : 'خصم',
      label_en: snapshot.discount_type === 'percentage' ? `Discount ${snapshot.discount_value}%` : 'Discount',
      amount: -round2(off * snapPeople),
    })
  }

  const reference = snapshot.price_override && isNum(snapshot.computed_total)
    ? snapshot.computed_total
    : (isNum(snapshot.total) ? snapshot.total : null)
  const target = agreedTotal ?? (isNum(snapshot.total) ? snapshot.total : sumLines(items))
  return { items, details, ...reconcile(items, adjustments, reference, target) }
}

// ─── Whole-invoice assembly ───

export type InvoiceSource =
  | {
      kind: 'accommodation'
      booking: AccommodationInvoiceRow & {
        customers?: { name?: string | null; phone?: string | null } | null
      }
    }
  | {
      kind: 'trip'
      booking: TripBookingRow & {
        id: string
        created_at: string
        customer_name?: string | null
        customer_phone?: string | null
        notes?: string | null
        amount_paid?: number | string | null
        customers?: { name?: string | null; phone?: string | null; email?: string | null } | null
      }
    }

/**
 * Everything generateInvoiceHTML needs, as a pure function of the booking
 * row (+ site settings for the terms text). No clock, no catalogue lookup:
 * the same row always renders the same invoice.
 */
export function buildInvoiceData(
  source: InvoiceSource,
  opts: { type: 'request' | 'confirmation'; locale: 'ar' | 'en'; settings: SiteSettings | null },
): InvoiceData {
  const { type, locale, settings } = opts
  if (source.kind === 'accommodation') {
    const b = source.booking
    const built = buildAccommodationInvoice(b, locale)
    return {
      type,
      invoiceNumber: buildInvoiceNumber('BK', b.id, b.created_at, type),
      customerName: b.customers?.name || b.customer_name || 'Customer',
      customerPhone: b.customers?.phone || b.customer_phone || '',
      customerEmail: b.customer_email || undefined,
      orderDate: formatDate(b.created_at, locale) ?? '',
      details: built.details,
      items: built.items,
      subtotal: built.subtotal,
      adjustments: built.adjustments,
      totalAmount: built.totalAmount,
      amountPaid: Number(b.amount_paid) || 0,
      notes: b.notes || undefined,
      locale,
      settings,
    }
  }
  const b = source.booking
  const built = buildTripInvoice(b, locale)
  return {
    type,
    invoiceNumber: buildInvoiceNumber('TB', b.id, b.created_at, type),
    customerName: b.customers?.name || b.customer_name || 'Customer',
    customerPhone: b.customers?.phone || b.customer_phone || '',
    customerEmail: b.customers?.email || undefined,
    orderDate: formatDate(b.created_at, locale) ?? '',
    details: built.details,
    items: built.items,
    subtotal: built.subtotal,
    adjustments: built.adjustments,
    totalAmount: built.totalAmount,
    // trip_bookings tracks payments too, so a trip invoice gets the same
    // paid / balance-due rows as an accommodation one.
    amountPaid: Number(b.amount_paid) || 0,
    notes: b.notes || undefined,
    locale,
    settings,
  }
}
