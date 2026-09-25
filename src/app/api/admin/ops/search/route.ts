import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizeOpsQuery } from '@/lib/ops/search'
import { isMissingOpsRelation, loadWorkItems } from '@/lib/ops/server'

export async function GET(req: NextRequest) {
  const gate = await requireStaff(req)
  if (!gate.ok) return gate.response
  const normalized = normalizeOpsQuery(req.nextUrl.searchParams.get('q') ?? '')
  if (normalized.text.length < 2 && !normalized.digits) {
    return NextResponse.json({ error: 'Query must be at least 2 characters', code: 'invalid' }, { status: 400 })
  }
  const supabase = getSupabaseAdmin(gate.staff)
  try {
    const like = `%${normalized.text}%`
    // customers.normalized_phone is digits-only, so a phone search matches on digits even when the
    // customer typed dashes, spaces or Arabic-Indic numerals; ops_work_items has no such column, so
    // its own phone match below stays text-based (best effort against the raw stored formatting).
    const customerOr = normalized.digits
      ? `name.ilike.${like},normalized_phone.ilike.%${normalized.digits}%`
      : `name.ilike.${like}`
    const [items, customers, stays, trips, packages, signatures, products] = await Promise.all([
      loadWorkItems(supabase, { q: normalized.text, view: 'all' }),
      supabase.from('customers').select('id, name, phone, email, updated_at').or(customerOr).limit(20),
      supabase.from('accommodations').select('id, name_en, name_ar, is_active')
        .or(`name_en.ilike.${like},name_ar.ilike.${like}`).limit(10),
      supabase.from('sinai_trips').select('id, name_en, name_ar, is_active')
        .or(`name_en.ilike.${like},name_ar.ilike.${like}`).limit(10),
      supabase.from('trip_packages').select('id, name_en, name_ar, is_active')
        .or(`name_en.ilike.${like},name_ar.ilike.${like}`).limit(10),
      supabase.from('experiences').select('id, title_en, title_ar, status')
        .or(`title_en.ilike.${like},title_ar.ilike.${like}`).limit(10),
      supabase.from('commerce_products').select('id, name_en, name_ar, is_active')
        .or(`name_en.ilike.${like},name_ar.ilike.${like}`).limit(10),
    ])
    const errors = [customers.error, stays.error, trips.error, packages.error, signatures.error, products.error]
      .filter(Boolean)
    if (errors.length) throw errors[0]
    const catalogue = [
      ...(stays.data ?? []).map((row: any) => (
        { type: 'stay', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...(trips.data ?? []).map((row: any) => (
        { type: 'trip', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...(packages.data ?? []).map((row: any) => (
        { type: 'package', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...(signatures.data ?? []).map((row: any) => (
        { type: 'signature', ...row, is_active: row.status === 'published', subtitle: '' }
      )),
      ...(products.data ?? []).map((row: any) => (
        { type: 'product', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
    ]
    return NextResponse.json({
      customers: (customers.data ?? []).map((row: any) => ({ ...row, last_activity_at: row.updated_at })),
      items: items.slice(0, 20),
      catalogue,
    })
  } catch (error) {
    console.error('ops search error:', error)
    return NextResponse.json(
      { error: 'Search failed', ...(isMissingOpsRelation(error) ? { code: 'migration_pending' } : {}) },
      { status: isMissingOpsRelation(error) ? 503 : 500 },
    )
  }
}
