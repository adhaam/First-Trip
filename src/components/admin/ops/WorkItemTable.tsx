'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatAmount, formatCount, formatDateShort, formatReference } from '@/lib/format'
import type { WorkItem } from '@/lib/ops/types'
import { customerHref, workItemHref } from '@/components/admin/ops/nav'
import { AttentionChips, EntityTypeLabel, NextActionLabel, PaymentPill, StatusPill, WaitingLabel, useItemTitle } from '@/components/admin/ops/pills'

/** Shared row list for the work queue, today view sections and a customer profile. */
export function WorkItemTable({
  items,
  emptyMessage,
  showType = true,
}: {
  items: WorkItem[]
  emptyMessage: string
  showType?: boolean
}) {
  const locale = useLocale()
  const titleOf = useItemTitle()
  const t = useTranslations('ops.queue.columns')
  const tCommon = useTranslations('ops.common')

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
              <TableRow key={`${item.entity_type}:${item.entity_id}`} className="relative">
                <TableCell className="font-medium">
                  <Link
                    href={workItemHref(item.entity_type, item.entity_id)}
                    className="static after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                  >
                    {formatReference(item.reference)}
                  </Link>
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
                <TableCell className="min-w-[160px] max-w-[220px] whitespace-normal text-sm">{titleOf(item)}</TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <StatusPill status={item.status} />
                    <AttentionChips codes={item.attention} />
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <PaymentPill paymentStatus={item.payment_status} />
                    {item.amount_total != null && (
                      <span className="text-xs text-muted-foreground">
                        {formatAmount(item.amount_paid ?? 0, locale)}/{formatAmount(item.amount_total, locale)}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="relative z-10 min-w-[130px] whitespace-normal text-sm">
                  {item.next_action !== 'none' ? (
                    <Link
                      href={workItemHref(item.entity_type, item.entity_id)}
                      className="font-medium text-sea-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                    >
                      <NextActionLabel action={item.next_action} />
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
          <li key={`${item.entity_type}:${item.entity_id}`} className="relative rounded-lg border p-3">
            <Link
              href={workItemHref(item.entity_type, item.entity_id)}
              className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
              aria-label={`${formatReference(item.reference)} — ${titleOf(item)}`}
            />
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium">{formatReference(item.reference)}</p>
                <p className="truncate text-sm text-muted-foreground">{titleOf(item)}</p>
              </div>
              <StatusPill status={item.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span>{item.customer_name}</span>
              {item.start_date && <span>{formatDateShort(item.start_date, locale)}</span>}
              <PaymentPill paymentStatus={item.payment_status} />
              <WaitingLabel hours={item.waiting_hours} stale={item.stale} />
            </div>
            {item.next_action !== 'none' && (
              <p className="relative z-10 mt-2 text-sm font-medium text-sea-900">
                <NextActionLabel action={item.next_action} />
              </p>
            )}
            <div className="relative z-10 mt-1"><AttentionChips codes={item.attention} /></div>
          </li>
        ))}
      </ul>
    </>
  )
}
