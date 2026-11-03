'use client'

import { Link } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { opsItemHref } from '@/components/admin/ops/nav'
import type { JourneyStayRow } from '@/lib/ops/journey-stays'
import { cn } from '@/lib/utils'

const STATE_LABELS = {
  requested: { ar: 'مطلوب — في انتظار التحويل', en: 'Requested — awaiting conversion', className: 'border-amber-300 bg-amber-50 text-amber-800' },
  converted: { ar: 'تم التحويل — حجز إقامة', en: 'Converted — hotel booking', className: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', className: 'border-gray-300 bg-gray-50 text-gray-600' },
} as const

/**
 * Build Your Trip journeys that include accommodation, shown in Bookings → Stays so a hotel request
 * is always findable here. Read-only on purpose: requested journeys have no booking yet, and a
 * converted journey's hotel booking is paid and documented on the journey — each row only links to
 * the right Operations Center record.
 */
export function JourneyStaysPanel({
  rows,
  ar,
  hotelName,
  fmtDate,
}: {
  rows: JourneyStayRow[]
  ar: boolean
  hotelName: (id: string) => string
  fmtDate: (iso?: string) => string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">
            {ar ? `طلبات إقامة من «خطّط رحلتك» (${rows.length})` : `Build Your Trip hotel requests (${rows.length})`}
          </h2>
          <p className="text-xs text-muted-foreground">
            {ar
              ? 'الإقامة المطلوبة عبر «خطّط رحلتك» تظهر هنا. الطلب غير المحوّل ليس حجزًا بعد — افتحه من رقم WR. بعد التحويل يظهر حجز الإقامة (BK) مرتبطًا برحلته، والمدفوعات تُسجَّل على الرحلة.'
              : 'Hotels requested through Build Your Trip. An unconverted request is not a booking yet — open it from its WR reference. Once converted, its hotel booking (BK) is linked to its journey, and payments are recorded on the journey.'}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="py-3 text-center text-sm text-gray-400">{ar ? 'لا توجد طلبات مطابقة' : 'No matching requests'}</p>
        ) : (
          <div className="divide-y">
            {rows.map((row) => {
              const state = STATE_LABELS[row.state]
              return (
                <div key={row.request_id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={opsItemHref('trip_request', row.request_id)} className="font-medium text-sea-900 hover:underline" dir="ltr">
                        {row.reference}
                      </Link>
                      <Badge variant="outline" className={cn('text-xs', state.className)}>{ar ? state.ar : state.en}</Badge>
                      {row.component && (
                        <Link href={opsItemHref('accommodation_booking', row.component.id)} className="text-xs text-sea-700 hover:underline" dir="ltr">
                          {row.component.reference}
                        </Link>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {row.customer_name}
                      {row.customer_phone ? <span dir="ltr"> · {row.customer_phone}</span> : null}
                      {' · '}{hotelName(row.accommodation_id)}
                    </p>
                  </div>
                  <div className="text-end text-xs text-muted-foreground">
                    <p className="whitespace-nowrap">
                      {fmtDate(row.arrival_date ?? undefined)}{row.departure_date ? ` → ${fmtDate(row.departure_date)}` : ''}
                      {' · '}{ar ? `${row.people} أفراد` : `${row.people} people`}
                    </p>
                    <p className="whitespace-nowrap">{ar ? 'أُرسل ' : 'Requested '}{fmtDate(row.created_at.split('T')[0])}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
