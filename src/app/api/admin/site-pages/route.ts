import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { isAllowedMediaUrl, isHeroUrlAcceptable, PAGE_KEYS } from '@/lib/site-pages-core'

const sitePageSchema = z.object({
  page_key: z.enum(PAGE_KEYS),
  hero_image_url: z.string().max(1000).nullable().optional(),
  hero_image_alt_en: z.string().max(300).nullable().optional(),
  hero_image_alt_ar: z.string().max(300).nullable().optional(),
  eyebrow_en: z.string().max(160).nullable().optional(),
  eyebrow_ar: z.string().max(160).nullable().optional(),
  title_en: z.string().max(200).nullable().optional(),
  title_ar: z.string().max(200).nullable().optional(),
  body_en: z.string().max(600).nullable().optional(),
  body_ar: z.string().max(600).nullable().optional(),
})

const SITE_PAGE_SELECT = [
  'page_key',
  'hero_image_url',
  'hero_image_alt_en',
  'hero_image_alt_ar',
  'eyebrow_en',
  'eyebrow_ar',
  'title_en',
  'title_ar',
  'body_en',
  'body_ar',
  'updated_at',
  'updated_by',
].join(',')

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const supabase = getSupabaseAdmin(gate.staff)
  const { data, error } = await supabase
    .from('site_pages')
    .select(SITE_PAGE_SELECT)
    .order('page_key', { ascending: true })
  if (error) {
    // Migration 047 not applied yet — surface an empty list rather than a 500
    // so the Website admin can still render (Pages tab shows "not set up").
    if (error.code === '42P01' || error.message?.toLowerCase().includes('does not exist')) {
      return NextResponse.json({ pages: [] })
    }
    console.error('GET site_pages error:', error)
    return NextResponse.json({ error: 'Failed to load pages' }, { status: 500 })
  }
  return NextResponse.json({ pages: data })
}

export async function PUT(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const body = await req.json().catch(() => null)
  const validated = sitePageSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const { page_key, ...fields } = validated.data
  const supabase = getSupabaseAdmin(gate.staff)
  const nextHeroUrl = fields.hero_image_url
  if (typeof nextHeroUrl === 'string' && nextHeroUrl && !isAllowedMediaUrl(nextHeroUrl)) {
    const { data: current, error: readError } = await supabase
      .from('site_pages')
      .select('hero_image_url')
      .eq('page_key', page_key)
      .maybeSingle()
    if (readError) {
      console.error('PUT site_pages read error:', readError)
      return NextResponse.json({ error: 'Failed to save page' }, { status: 500 })
    }
    if (!isHeroUrlAcceptable(nextHeroUrl, current?.hero_image_url)) {
      return NextResponse.json({
        error: 'Invalid data',
        details: {
          formErrors: [],
          fieldErrors: {
            hero_image_url: ['Use a local path or an image URL from the configured Supabase storage'],
          },
        },
      }, { status: 400 })
    }
  }
  const { data, error } = await supabase
    .from('site_pages')
    .upsert(
      { page_key, ...fields, updated_at: new Date().toISOString(), updated_by: gate.staff.actor },
      { onConflict: 'page_key' },
    )
    .select(SITE_PAGE_SELECT)
    .single()
  if (error) {
    console.error('PUT site_pages error:', error)
    return NextResponse.json({ error: 'Failed to save page' }, { status: 500 })
  }
  return NextResponse.json({ page: data })
}
