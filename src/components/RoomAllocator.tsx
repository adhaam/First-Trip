'use client'

/**
 * RoomAllocator — lets users distribute a party across room types.
 *
 * Occupancy rules (authoritative — matches pricing.ts roomOccupancy):
 *   single  → 1 person
 *   double  → 2 people
 *   triple  → 3 people
 *
 * Server remains the source of truth for pricing.
 * This component only manages the allocation state; it never calculates prices.
 */

import { useLocale } from 'next-intl'
import { BedDouble, BedSingle, Minus, Plus, AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type RoomType = 'single' | 'double' | 'triple'

export interface RoomAllocation {
  type: RoomType
  count: number
  /** Optional upgrade supplement selected for this room block. */
  upgrade_id?: string
  upgrade_extra_per_night?: number
  upgrade_name?: string
}

/** Authoritative occupancy — must match pricing.ts roomOccupancy() */
export const ROOM_OCCUPANCY: Record<RoomType, number> = {
  single: 1,
  double: 2,
  triple: 3,
}

interface RoomAllocatorProps {
  numPeople: number
  allocations: RoomAllocation[]
  onChange: (allocations: RoomAllocation[]) => void
}

const ROOM_TYPES: { type: RoomType; label_ar: string; label_en: string; cap_ar: string; cap_en: string }[] = [
  { type: 'single', label_ar: 'سينجل', label_en: 'Single', cap_ar: 'شخص ١', cap_en: '1 person' },
  { type: 'double', label_ar: 'دبل', label_en: 'Double', cap_ar: 'حتى ٢ أشخاص', cap_en: 'up to 2 people' },
  { type: 'triple', label_ar: 'تريبل', label_en: 'Triple', cap_ar: 'حتى ٣ أشخاص', cap_en: 'up to 3 people' },
]

export function RoomAllocator({ numPeople, allocations, onChange }: RoomAllocatorProps) {
  const locale = useLocale()
  const ar = locale === 'ar'

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + ROOM_OCCUPANCY[a.type] * a.count,
    0,
  )
  const remaining = numPeople - totalAllocated
  const isExact = remaining === 0
  const isOver = remaining < 0

  const getAlloc = (type: RoomType) =>
    allocations.find((a) => a.type === type)?.count ?? 0

  const setCount = (type: RoomType, delta: number) => {
    const current = getAlloc(type)
    const next = Math.max(0, current + delta)
    if (next === current) return

    // Would this put us over?
    const newAllocated = totalAllocated + ROOM_OCCUPANCY[type] * delta
    if (delta > 0 && newAllocated > numPeople) return // guard: can't go over

    onChange(
      next === 0
        ? allocations.filter((a) => a.type !== type)
        : allocations.some((a) => a.type === type)
        ? allocations.map((a) => (a.type === type ? { ...a, count: next } : a))
        : [...allocations, { type, count: next }],
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-sea-900/60 mb-1">
        {ar
          ? `وزع ${numPeople} ضيف على أنواع الغرف`
          : `Distribute ${numPeople} guests across room types`}
      </div>

      {ROOM_TYPES.map(({ type, label_ar, label_en, cap_ar, cap_en }) => {
        const count = getAlloc(type)
        const occupancy = ROOM_OCCUPANCY[type]
        const persons = occupancy * count

        return (
          <div
            key={type}
            className={cn(
              'flex items-center justify-between rounded-lg border p-3 transition-colors',
              count > 0 ? 'border-sea-300 bg-sea-50/40' : 'border-sand-200 bg-white',
            )}
          >
            <div className="flex items-center gap-3">
              {type === 'single' ? (
                <BedSingle className="h-5 w-5 shrink-0 text-sea-600" />
              ) : (
                <BedDouble className="h-5 w-5 shrink-0 text-sea-600" />
              )}
              <div>
                <div className="font-semibold text-sm text-sea-900">
                  {ar ? label_ar : label_en}
                </div>
                <div className="text-[11px] text-sea-900/50">
                  {ar ? cap_ar : cap_en}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {count > 0 && (
                <span className="text-xs text-sea-900/50 tabular-nums">
                  = {persons} {ar ? (persons === 1 ? 'شخص' : 'أشخاص') : (persons === 1 ? 'person' : 'people')}
                </span>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCount(type, -1)}
                  disabled={count === 0}
                  aria-label={ar ? `تقليل ${label_ar}` : `Remove ${label_en} room`}
                  className="flex h-7 w-7 items-center justify-center rounded border border-sand-300 bg-white text-sea-900 hover:bg-sand-100 disabled:opacity-30 transition-colors"
                >
                  <Minus className="h-3 w-3" />
                </button>
                <span className="w-6 text-center text-sm font-bold text-sea-900 tabular-nums">
                  {count}
                </span>
                <button
                  type="button"
                  onClick={() => setCount(type, 1)}
                  disabled={totalAllocated + occupancy > numPeople}
                  aria-label={ar ? `إضافة ${label_ar}` : `Add ${label_en} room`}
                  className="flex h-7 w-7 items-center justify-center rounded border border-brand-blue bg-brand-blue/5 text-brand-blue hover:bg-brand-blue/10 disabled:opacity-30 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Status bar */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold',
          isExact
            ? 'bg-green-50 text-green-700 border border-green-200'
            : isOver
            ? 'bg-red-50 text-red-700 border border-red-200'
            : 'bg-amber-50 text-amber-700 border border-amber-200',
        )}
      >
        {isExact ? (
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        )}
        {isExact
          ? ar
            ? `✓ تم توزيع ${numPeople} ضيف بالكامل`
            : `✓ All ${numPeople} guests allocated`
          : isOver
          ? ar
            ? `السعة تجاوزت عدد الضيوف بمقدار ${Math.abs(remaining)}`
            : `Over capacity by ${Math.abs(remaining)}`
          : ar
          ? `تبقى ${remaining} ${remaining === 1 ? 'ضيف' : 'أضياف'} بدون توزيع`
          : `${remaining} guest${remaining !== 1 ? 's' : ''} still need a room`}
      </div>
    </div>
  )
}
