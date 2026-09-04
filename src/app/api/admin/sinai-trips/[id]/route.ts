import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import {
  assertDiscountFitsPrice, tripDiscountFields, validateTripDiscount,
} from '@/lib/trip-discounts'
import type { TripDiscountType } from '@/lib/types'

const tripUpdateSchema = z.object({
  name_ar: z.string().min(1).optional(),
  name_en: z.string().min(1).optional(),
  description_ar: z.string().optional(),
  description_en: z.string().optional(),
  category_ar: z.string().optional(),
  category_en: z.string().optional(),
  trip_category_id: z.string().uuid().nullable().optional(),
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
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const body = await req.json().catch(() => null)
  const validated = tripUpdateSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()

  // A PATCH can move `price` and `discount_value` independently, so the
  // "flat discount <= price" rule has to be checked against the merged
  // result rather than the payload alone. Only fetch when it can matter.
  const touchesPricing =
    validated.data.price !== undefined
    || validated.data.discount_type !== undefined
    || validated.data.discount_value !== undefined
  if (touchesPricing) {
    const { data: current, error: currentError } = await supabase
      .from('sinai_trips')
      .select('price, discount_type, discount_value')
      .eq('id', id)
      .single()
    if (currentError || !current) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 })
    }
    const nextPrice = validated.data.price ?? (Number(current.price) || 0)
    const nextType = (validated.data.discount_type !== undefined
      ? validated.data.discount_type
      : (current.discount_type as TripDiscountType | null)) ?? null
    const nextValue = validated.data.discount_value ?? (Number(current.discount_value) || 0)
    const conflict = assertDiscountFitsPrice(nextType, nextValue, nextPrice)
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 400 })
    }
  }

  const { data, error } = await supabase.from('sinai_trips').update(validated.data).eq('id', id).select().single()
  if (error) {
    console.error('PATCH sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to update trip' }, { status: 500 })
  }
  return NextResponse.json({ trip: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('sinai_trips').delete().eq('id', id)
  if (error) {
    console.error('DELETE sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to delete trip' }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
