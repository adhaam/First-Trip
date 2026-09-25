import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  assertDiscountFitsPrice, tripDiscountFields, validateTripDiscount,
} from '@/lib/trip-discounts'
import type { TripDiscountType } from '@/lib/types'
import { syncTripCategoryTags } from '../tag-sync'

const tripUpdateSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  category_ar: z.string().optional(),
  category_en: z.string().optional(),
  trip_category_id: z.string().uuid().nullable().optional(),
  category_ids: z.array(z.string().uuid()).optional(),
  images: z.array(z.string()).optional(),
  duration: z.string().optional(),
  duration_en: z.string().optional(),
  price: z.number().min(0).optional(),
  // Legacy package-cost field, retained for historical bookings/snapshots only.
  package_price: z.number().min(0).nullable().optional(),
  includes_ar: z.array(z.string()).optional(),
  includes_en: z.array(z.string()).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  ...tripDiscountFields,
}).superRefine(validateTripDiscount)

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = tripUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { category_ids, ...tripUpdate } = validated.data
  const supabase = getSupabaseAdmin(gate.staff)

  // A PATCH can move `price` and `discount_value` independently, so the
  // "flat discount <= price" rule has to be checked against the merged
  // result rather than the payload alone. Only fetch when it can matter.
  const touchesPricing =
    tripUpdate.price !== undefined
    || tripUpdate.discount_type !== undefined
    || tripUpdate.discount_value !== undefined
  const needsCurrentTrip = touchesPricing || category_ids !== undefined
  let currentPrimaryCategoryId: string | null | undefined
  if (needsCurrentTrip) {
    const { data: currentTrip, error: currentError } = await supabase
      .from('sinai_trips')
      .select('price, discount_type, discount_value, trip_category_id')
      .eq('id', id)
      .single()
    if (currentError || !currentTrip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }
    currentPrimaryCategoryId = currentTrip.trip_category_id as string | null
    if (touchesPricing) {
      const nextPrice = tripUpdate.price ?? (Number(currentTrip.price) || 0)
      const nextType = (tripUpdate.discount_type !== undefined
        ? tripUpdate.discount_type
      : (currentTrip.discount_type as TripDiscountType | null)) ?? null
      const nextValue = tripUpdate.discount_value ?? (Number(currentTrip.discount_value) || 0)
      const conflict = assertDiscountFitsPrice(nextType, nextValue, nextPrice)
      if (conflict) {
        return NextResponse.json({ error: conflict }, { status: 400 })
      }
    }
  }

  const { data, error } = await supabase.from('sinai_trips').update(tripUpdate).eq('id', id).select().single()
  if (error) {
    console.error('PATCH sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
  if (category_ids !== undefined || tripUpdate.trip_category_id !== undefined) {
    const primaryCategoryId = data.trip_category_id ?? currentPrimaryCategoryId
    const tagSync = await syncTripCategoryTags(
      supabase,
      id,
      category_ids ?? [],
      primaryCategoryId,
      category_ids === undefined,
    )
    if (tagSync.error) return NextResponse.json({ error: tagSync.error }, { status: 500 })
    return NextResponse.json({ trip: data, warning: tagSync.warning })
  }
  return NextResponse.json({ trip: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const { id } = await params
  const supabase = getSupabaseAdmin(gate.staff)
  const { error } = await supabase.from('sinai_trips').delete().eq('id', id)
  if (error) {
    console.error('DELETE sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
