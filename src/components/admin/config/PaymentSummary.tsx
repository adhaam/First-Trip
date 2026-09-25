'use client'

// Shared read-only payment display for the legacy managers (BookingsManager,
// TripBookingsManager, ExperienceRequestsManager, CommerceManager). Since
// migration 036 money moves only through the append-only ledger
// (POST /api/admin/payments), these managers never edit payment_status or
// amount_paid inline — they show the current figures and hand off to the
// item's detail screen in the Operations Center, where payments are recorded.

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { opsItemHref } from '@/components/admin/ops/nav'
import type { OpsEntityType } from '@/lib/ops/types'

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'refunded'

const PAYMENT_STYLES: Record<PaymentStatus, string> = {
  unpaid: 'bg-red-50 text-red-600',
  partial: 'bg-yellow-50 text-yellow-700',
  paid: 'bg-green-50 text-green-700',
  refunded: 'bg-gray-100 text-gray-600',
}

const STATUS_KEY: Record<PaymentStatus, string> = {
  unpaid: 'statusUnpaid',
  partial: 'statusPartial',
  paid: 'statusPaid',
  refunded: 'statusRefunded',
}

function normalize(status: string | null | undefined): PaymentStatus {
  return status && status in PAYMENT_STYLES ? (status as PaymentStatus) : 'unpaid'
}

export function PaymentStatusPill({ status }: { status: string | null | undefined }) {
  const t = useTranslations('opsConfig.payment')
  const key = normalize(status)
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', PAYMENT_STYLES[key])}>
      {t(STATUS_KEY[key])}
    </span>
  )
}

export function PaymentSummary({
  entityType, entityId, paymentStatus, amountPaid, total, compact,
}: {
  entityType: OpsEntityType
  entityId: string
  paymentStatus: string | null | undefined
  amountPaid: number | null | undefined
  total: number | null | undefined
  compact?: boolean
}) {
  const t = useTranslations('opsConfig.payment')
  const tCommon = useTranslations('opsConfig.common')
  const router = useRouter()
  const paid = Number(amountPaid) || 0
  const totalAmount = Number(total) || 0
  const remaining = Math.max(0, totalAmount - paid)
  const currency = tCommon('currency')

  return (
    <div className={cn('flex flex-wrap items-center gap-3', compact ? 'text-xs' : 'text-sm')}>
      <PaymentStatusPill status={paymentStatus} />
      <span className="text-gray-600">
        {t('paidOf', { paid: paid.toLocaleString(), total: totalAmount.toLocaleString(), currency })}
      </span>
      {remaining > 0 && (
        <span className="font-medium text-red-600">
          {t('remaining', { amount: remaining.toLocaleString(), currency })}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => router.push(opsItemHref(entityType, entityId))}
      >
        <CreditCard className="h-3.5 w-3.5" />
        {t('viewPayments')}
      </Button>
    </div>
  )
}
