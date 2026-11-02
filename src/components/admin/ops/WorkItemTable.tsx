'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight } from 'lucide-react'
import { Link } from '@/i18n/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount, formatCount, formatDateShort, formatReference } from '@/lib/format'
import type { WorkItem } from '@/lib/ops/types'
import { cn } from '@/lib/utils'
import { customerHref, workItemHref } from '@/components/admin/ops/nav'
import {
  AttentionChips, EntityTypeLabel, JourneyBadge, NextActionLabel, PaymentPill, StatusPill, WaitingLabel, useItemTitle,
} from '@/components/admin/ops/pills'

/**
 * Parent journeys first, each followed directly by its components (bookings/trip bookings converted
 * off it), so a customer's list never reads as separate bills. Rows keep their incoming order otherwise.
 */
function withComponentsUnderParents(items: WorkItem[]): WorkItem[] {
  const parents = new Set(items.filter((i) => i.entity_type === 'trip_request').map((i) => i.entity_id))
  const byParent = new Map<string, WorkItem[]>()
  for (const item of items) {
    if (item.journey_component && item.trip_request_id && parents.has(item.trip_request_id)) {
      byParent.set(item.trip_request_id, [...(byParent.get(item.trip_request_id) ?? []), item])
    }
  }
  const nested = new Set([...byParent.values()].flat())
  return items.filter((i) => !nested.has(i)).flatMap((i) => [i, ...(byParent.get(i.entity_id) ?? [])])
}

/** Shared row list for the work queue, today view sections and a customer profile. */
export function WorkItemTable({
  items: rawItems,
  emptyMessage,
  showType = true,
  groupComponents = false,
}: {
  items: WorkItem[]
  emptyMessage: string
  showType?: boolean
  /** Place journey components directly under their parent journey (customer profile). */
  groupComponents?: boolean
}) {
  const items = groupComponents ? withComponentsUnderParents(rawItems) : rawItems
  // WR-… reference of each journey on screen, so a component can say which journey manages it.
  const journeyRef = new Map(rawItems.filter((i) => i.entity_type === 'trip_request').map((i) => [i.entity_id, i.reference]))
  const parentRefOf = (item: WorkItem) => (item.trip_request_id ? journeyRef.get(item.trip_request_id) : undefined)
  const locale = useLocale()
  const titleOf = useItemTitle()
  const t = useTranslations('ops.queue.columns')
  const tQueue = useTranslations('ops.queue')
  const tCommon = useTranslations('ops.common')
  const tItem = useTranslations('ops.item')

  const managedOn = (item: WorkItem) => {
    const ref = parentRefOf(item)
    return ref ? tQueue('managedOnJourney', { reference: formatReference(ref) }) : tQueue('managedOnJourneyGeneric')
  }

  if (!items.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('reference')}</TableHead>
              {showType && <TableHead>{t('type')}</TableHead>}
              <TableHead>{t('customer')}</TableHead>
              <TableHead>{t('dates')}</TableHead>
              <TableHead>{t('title')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('payment')}</TableHead>
              <TableHead>{t('nextAction')}</TableHead>
              <TableHead>{t('waiting')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={`${item.entity_type}:${item.entity_id}`} className={cn('relative', item.journey_component && 'bg-muted/30')}>
                <TableCell className="font-medium">
                  <Link
                    href={workItemHref(item.entity_type, item.entity_id)}
                    className="static after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                  >
                    {formatReference(item.reference)}
                  </Link>
                  {item.journey_component && (
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {parentRefOf(item)
                        ? tQueue('partOfJourneyRef', { reference: formatReference(parentRefOf(item) as string) })
                        : tItem('partOfJourney')}
                    </span>
                  )}
                </TableCell>
                {showType && (
                  <TableCell className="text-sm text-muted-foreground">
                    <EntityTypeLabel type={item.entity_type} />
                  </TableCell>
                )}
                <TableCell>
                  <div className="flex flex-col">
                    {item.customer_id ? (
                      <Link
                        href={customerHref(item.customer_id)}
                        className="relative z-10 font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                      >
                        {item.customer_name}
                      </Link>
                    ) : (
                      <span>{item.customer_name}</span>
                    )}
                    <span className="text-xs text-muted-foreground" dir="ltr">{item.customer_phone}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {item.start_date ? formatDateShort(item.start_date, locale) : tCommon('none')}
                  {item.people ? <span className="ms-1 text-muted-foreground">· {formatCount(item.people, locale)}</span> : null}
                </TableCell>
                <TableCell className="min-w-[160px] max-w-[220px] whitespace-normal text-sm">
                  <div className="flex flex-wrap items-center gap-1">
                    <span>{titleOf(item)}</span>
                    {item.entity_type === 'trip_request' && item.converted && <JourneyBadge />}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <StatusPill status={item.status} />
                    <AttentionChips codes={item.attention} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {/* Journey components are fulfilment-only: the journey (WR-…) is the one payment owner. */}
                    {item.journey_component ? (
                      <span className="text-xs text-muted-foreground">{tItem('paidViaJourney')}</span>
                    ) : (
                      <PaymentPill paymentStatus={item.payment_status} />
                    )}
                    {!item.journey_component && item.amount_total != null && (
                      <span className="text-xs text-muted-foreground">
                        {formatAmount(item.amount_paid ?? 0, locale)}/{formatAmount(item.amount_total, locale)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="relative z-10 min-w-[130px] whitespace-normal text-sm">
                  {item.journey_component ? (
                    <span className="text-xs text-muted-foreground">{managedOn(item)}</span>
                  ) : item.next_action !== 'none' ? (
                    <Link
                      href={workItemHref(item.entity_type, item.entity_id)}
                      className="group flex flex-col font-medium text-sea-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                    >
                      <span className="text-xs font-normal text-muted-foreground">{tQueue('goToItem')}</span>
                      <span className="inline-flex items-center gap-1 group-hover:underline">
                        <NextActionLabel action={item.next_action} />
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden />
                      </span>
                    </Link>
                  ) : (
                    <span className="text-muted-foreground"><NextActionLabel action={item.next_action} /></span>
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  <WaitingLabel hours={item.waiting_hours} stale={item.stale} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: stacked cards */}
      <ul className="flex flex-col gap-3 md:hidden">
        {items.map((item) => (
          <li key={`${item.entity_type}:${item.entity_id}`} className={cn('relative rounded-lg border p-3', item.journey_component && 'bg-muted/30')}>
            <Link
              href={workItemHref(item.entity_type, item.entity_id)}
              className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              aria-label={`${formatReference(item.reference)} — ${titleOf(item)}`}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{formatReference(item.reference)}</p>
                <p className="truncate text-sm text-muted-foreground">{titleOf(item)}</p>
                {item.entity_type === 'trip_request' && item.converted && <JourneyBadge className="mt-1" />}
              </div>
              <StatusPill status={item.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{item.customer_name}</span>
              {item.start_date && <span>{formatDateShort(item.start_date, locale)}</span>}
              {item.journey_component
                ? <span>{tItem('paidViaJourney')}</span>
                : <PaymentPill paymentStatus={item.payment_status} />}
              <WaitingLabel hours={item.waiting_hours} stale={item.stale} />
            </div>
            {item.journey_component ? (
              <p className="relative z-10 mt-2 text-xs text-muted-foreground">{managedOn(item)}</p>
            ) : item.next_action !== 'none' && (
              <p className="relative z-10 mt-2 text-sm font-medium text-sea-900">
                <span className="me-1 text-xs font-normal text-muted-foreground">{tQueue('goToItem')}</span>
                <span className="inline-flex items-center gap-1">
                  <NextActionLabel action={item.next_action} />
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 rtl:rotate-180" aria-hidden />
                </span>
              </p>
            )}
            <div className="relative z-10 mt-1"><AttentionChips codes={item.attention} /></div>
          </li>
        ))}
      </ul>
    </>
  )
}
