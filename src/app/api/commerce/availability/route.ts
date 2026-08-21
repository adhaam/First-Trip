import { NextRequest, NextResponse } from 'next/server'
import { checkRentalAvailability, getTotalInventory } from '@/lib/rental-availability'

/**
 * Public, read-only rental availability estimate — used by the storefront
 * configurator to show a live "only N left" hint before the customer adds
 * to cart. This is advisory only: the authoritative, concurrency-safe check
 * happens again inside createCommerceOrder() at checkout submission time
 * (see "10. RENTAL AVAILABILITY" — never rely solely on a check from an
 * earlier page load).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const productId = searchParams.get('product_id')
  const variantId = searchParams.get('variant_id')
  const startDate = searchParams.get('start_date')
  const endDate = searchParams.get('end_date')
  const quantity = Number(searchParams.get('quantity') || '1')

  if (!productId || !startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return NextResponse.json({ error: 'Missing or invalid parameters' }, { status: 400 })
  }

  try {
    const totalInventory = await getTotalInventory(productId, variantId || null)
    const result = await checkRentalAvailability({
      productId,
      variantId: variantId || null,
      startDate,
      endDate,
      totalInventory,
      requestedQuantity: Math.max(1, quantity),
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('Commerce availability API error:', err)
    return NextResponse.json({ error: 'Failed to check availability' }, { status: 500 })
  }
}
