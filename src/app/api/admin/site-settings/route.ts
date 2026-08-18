import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const settingsSchema = z.object({
  hero_type: z.enum(['image', 'video']).optional(),
  hero_media_url: z.string().optional(),
  whatsapp_number: z.string().optional(),
  phone_number: z.string().optional(),
  email: z.string().optional(),
  facebook_url: z.string().optional(),
  instagram_url: z.string().optional(),
  location: z.string().max(200).optional(),
  logo_url: z.string().optional(),
  refund_policy_ar: z.string().optional(),
  refund_policy_en: z.string().optional(),
  privacy_policy_ar: z.string().optional(),
  privacy_policy_en: z.string().optional(),
  terms_ar: z.string().optional(),
  terms_en: z.string().optional(),
  package_included_trip_ids: z.array(z.string().uuid()).optional(),
  // ─── Website CMS (migration 005) ───
  hero_heading_ar: z.string().max(160).optional(),
  hero_heading_en: z.string().max(160).optional(),
  hero_subheading_ar: z.string().max(240).optional(),
  hero_subheading_en: z.string().max(240).optional(),
  primary_cta_label_ar: z.string().max(80).optional(),
  primary_cta_label_en: z.string().max(80).optional(),
  secondary_cta_label_ar: z.string().max(80).optional(),
  secondary_cta_label_en: z.string().max(80).optional(),
  featured_accommodation_ids: z.array(z.string().uuid()).optional(),
  featured_trip_ids: z.array(z.string().uuid()).optional(),
  show_community: z.boolean().optional(),
  show_partners: z.boolean().optional(),
  show_newsletter: z.boolean().optional(),
  seo_title: z.string().max(160).optional(),
  seo_description_ar: z.string().max(400).optional(),
  seo_description_en: z.string().max(400).optional(),
  social_share_image: z.string().max(500).optional(),
  organization_name: z.string().max(120).optional(),
})

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('site_settings').select('*').eq('id', 1).single()
  if (error) {
    console.error('GET site_settings error:', error)
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 })
  }
  return NextResponse.json({ settings: data })
}

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = settingsSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('site_settings').update(validated.data).eq('id', 1).select().single()
  if (error) {
    console.error('PATCH site_settings error:', error)
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 })
  }
  return NextResponse.json({ settings: data })
}
