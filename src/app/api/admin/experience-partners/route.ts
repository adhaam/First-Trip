import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

const partnerSchema = z.object({
  name: z.string().min(1),
  service_category: z.string().optional().default(''),
  public_description_ar: z.string().optional().default(''),
  public_description_en: z.string().optional().default(''),
  contact_name: z.string().optional().default(''),
  contact_phone: z.string().optional().default(''),
  contact_email: z.string().optional().default(''),
  internal_notes: z.string().optional().default(''),
  public_credit_enabled: z.boolean().optional().default(false),
  is_active: z.boolean().optional().default(true),
})

// This route is admin-only end to end (requireAdmin gate + service-role
// client + no public RLS read policy on experience_partners at all) — the
// only place private contact fields are ever readable.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('experience_partners')
    .select('*')
    .order('name', { ascending: true })
  if (error) return NextResponse.json({ error: 'Failed to load partners' }, { status: 500 })
  return NextResponse.json({ partners: data })
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const validated = partnerSchema.safeParse(body)
  if (!validated.success) {
    return NextResponse.json({ error: 'Invalid data', details: validated.error.flatten() }, { status: 400 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase.from('experience_partners').insert(validated.data).select().single()
  if (error) {
    console.error('POST experience_partner error:', error)
    return NextResponse.json({ error: 'Failed to create partner' }, { status: 500 })
  }
  return NextResponse.json({ partner: data }, { status: 201 })
}
