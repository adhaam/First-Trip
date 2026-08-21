import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { getSupabaseAdmin } from '@/lib/supabase'

// Rental reservations list — the operational queue (requested/contacted/
// confirmed/active/returned/...), separate from generic merch orders since
// rentals have their own lifecycle (see 08. RENTAL INVENTORY / AVAILABILITY).
export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('rental_reservations')
    .select('*, commerce_products(name_ar, name_en), commerce_order_items(order_id, commerce_orders(order_number, customer_id, customers(name, phone)))')
    .order('start_date', { ascending: true })
    .limit(300)
  if (error) {
    console.error('GET rental_reservations error:', error)
    return NextResponse.json({ error: 'Failed to load rentals' }, { status: 500 })
  }
  return NextResponse.json({ reservations: data })
}
