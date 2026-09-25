import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'
import { normalizeOpsQuery } from '@/lib/ops/search'
import { isMissingOpsRelation, loadWorkItems } from '@/lib/ops/server'

/** Matches the id/name_en/name_ar/is_active columns selected for stays, trips, packages, products. */
type CatalogueNameRow = { id: string, name_en: string, name_ar: string, is_active: boolean }
/** Matches the id/title_en/title_ar/status columns selected for signature experiences. */
type SignatureCatalogueRow = { id: string, title_en: string, title_ar: string, status: string }
/** Matches the customers columns selected below. */
type CustomerSearchRow = { id: string, name: string, phone: string, email: string | null, updated_at: string }

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
    const stayRows = (stays.data ?? []) as CatalogueNameRow[]
    const tripRows = (trips.data ?? []) as CatalogueNameRow[]
    const packageRows = (packages.data ?? []) as CatalogueNameRow[]
    const signatureRows = (signatures.data ?? []) as SignatureCatalogueRow[]
    const productRows = (products.data ?? []) as CatalogueNameRow[]
    const customerRows = (customers.data ?? []) as CustomerSearchRow[]

    const catalogue = [
      ...stayRows.map((row) => (
        { type: 'stay', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...tripRows.map((row) => (
        { type: 'trip', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...packageRows.map((row) => (
        { type: 'package', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
      ...signatureRows.map((row) => (
        { type: 'signature', ...row, is_active: row.status === 'published', subtitle: '' }
      )),
      ...productRows.map((row) => (
        { type: 'product', ...row, title_en: row.name_en, title_ar: row.name_ar, subtitle: '' }
      )),
    ]
    return NextResponse.json({
      customers: customerRows.map((row) => ({ ...row, last_activity_at: row.updated_at })),
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
