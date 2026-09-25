type StoredPaymentPlan = {
  upfrontPercent?: unknown
  upfrontDue?: unknown
  balanceDue?: unknown
}

type StoredQuoteLine = {
  label_ar?: unknown
  label_en?: unknown
  detail_ar?: unknown
  detail_en?: unknown
  amount?: unknown
}

/** Safely turns the frozen payment-plan JSON into an operations-only summary. */
export function paymentPlanSummary(paymentPlan: unknown, locale: 'ar' | 'en'): string {
  const plan = paymentPlan && typeof paymentPlan === 'object' ? paymentPlan as StoredPaymentPlan : null
  if (!plan) return locale === 'ar' ? 'غير متاح' : 'Unavailable'

  const percent = typeof plan.upfrontPercent === 'number' ? `${plan.upfrontPercent}%` : null
  const afterConfirmation = locale === 'ar' ? 'بعد التأكيد' : 'after confirmation'
  const onArrival = locale === 'ar' ? 'المتبقي عند الوصول' : 'balance on arrival'
  const beforeService = locale === 'ar' ? 'المتبقي قبل الخدمة' : 'balance before service'

  if (plan.balanceDue === 'on_arrival') return `${percent ? `${percent} ` : ''}${afterConfirmation} · ${onArrival}`
  if (plan.balanceDue === 'before_service') return `${percent ? `${percent} ` : ''}${afterConfirmation} · ${beforeService}`
  return `${percent ? `${percent} ` : ''}${afterConfirmation}`
}

/** Quote snapshots are JSON; this avoids trusting a malformed historic snapshot in the UI. */
export function quoteSnapshotLines(snapshot: unknown, locale: 'ar' | 'en') {
  if (!snapshot || typeof snapshot !== 'object') return []
  const lines = (snapshot as { lines?: unknown }).lines
  if (!Array.isArray(lines)) return []
  return lines.flatMap((line): { label: string; detail: string; amount: number | null }[] => {
    if (!line || typeof line !== 'object') return []
    const item = line as StoredQuoteLine
    const label = locale === 'ar' ? item.label_ar : item.label_en
    const detail = locale === 'ar' ? item.detail_ar : item.detail_en
    const amount = typeof item.amount === 'number' && Number.isFinite(item.amount) ? item.amount : null
    return typeof label === 'string' ? [{ label, detail: typeof detail === 'string' ? detail : '', amount }] : []
  })
}
