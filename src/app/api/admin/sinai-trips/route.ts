import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const tripSchema = z.object({
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  description_ar: z.string().optional().default(''),
  description_en: z.string().optional().default(''),
  category_ar: z.string().optional().default(''),
  category_en: z.string().optional().default(''),
  images: z.array(z.string()).optional().default([]),
  duration: z.string().optional().default(''),
  duration_en: z.string().optional().default(''),
  price: z.number().min(0),
  includes_ar: z.array(z.string()).optional().default([]),
  includes_en: z.array(z.string()).optional().default([]),
  is_active: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('sinai_trips').select('*').order('created_at', { ascending: false })
  if (error) {
    console.error('GET sinai_trips error:', error)
    return NextResponse.json({ error: 'Failed to load trips' }, { status: 500 })
  }
  return NextResponse.json({ trips: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = tripSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('sinai_trips').insert(validated.data).select().single()
  if (error) {
    console.error('POST sinai_trip error:', error)
    return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 })
  }
  return NextResponse.json({ trip: data }, { status: 201 })
}
