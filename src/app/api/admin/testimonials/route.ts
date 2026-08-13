import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const testimonialSchema = z.object({
  name: z.string().min(2).max(120),
  text_ar: z.string().max(2000).optional().default(''),
  text_en: z.string().max(2000).optional().default(''),
  rating: z.number().int().min(1).max(5).optional().default(5),
  avatar_url: z.string().optional().nullable(),
  trip_ar: z.string().max(200).optional().default(''),
  trip_en: z.string().max(200).optional().default(''),
  source: z.string().max(40).optional().default('facebook'),
  source_url: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).optional().default(0),
  is_published: z.boolean().optional().default(true),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('testimonials')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('GET testimonials error:', error)
    return NextResponse.json({ error: 'Failed to load testimonials' }, { status: 500 })
  }
  return NextResponse.json({ testimonials: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = testimonialSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json(
      { error: 'Invalid data', details: validated.error.flatten() },
      { status: 400 },
    )
  }
  if (!validated.data.text_ar && !validated.data.text_en) {
    return NextResponse.json({ error: 'At least one language is required' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('testimonials')
    .insert(validated.data)
    .select()
    .single()

  if (error) {
    console.error('POST testimonial error:', error)
    return NextResponse.json({ error: 'Failed to create testimonial' }, { status: 500 })
  }
  return NextResponse.json({ testimonial: data }, { status: 201 })
}
