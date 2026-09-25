'use client'

// GET /api/admin/ops/catalogue-health (docs/m3/OPS_API_CONTRACT.md). Read-only —
// each issue links back to the relevant legacy catalogue section via dashboardHref().

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Link, useRouter } from '@/i18n/navigation'
import { CheckCircle2, Loader2, ArrowUpRight } from 'lucide-react'
import { dashboardHref } from '@/components/admin/ops/nav'

type CatalogueItemType = 'accommodation' | 'sinai_trip' | 'trip_package' | 'signature_experience' | 'commerce_product'

interface CatalogueIssue {
  type: CatalogueItemType
  id: string
  title_ar: string
  title_en: string
  code: string
}

const SECTION_BY_TYPE: Record<CatalogueItemType, string> = {
  accommodation: 'accommodations',
  sinai_trip: 'sinai-trips',
  trip_package: 'trip-packages',
  signature_experience: 'signature-experiences',
  commerce_product: 'commerce',
}

// Codes returned by GET /api/admin/ops/catalogue-health.
const KNOWN_ISSUE_CODES = [
  'no_images',
  'no_room_price',
  'no_price',
  'no_category_tag',
  'too_few_items',
  'item_missing_package_price',
  'no_active_variant',
  'zero_stock',
  'no_active_pricing_tier',
  'no_upcoming_open_date',
]

export function CatalogueHealthPanel() {
  const router = useRouter()
  const t = useTranslations('opsConfig.catalogueHealth')
  const tCommon = useTranslations('opsConfig.common')
  const locale = useLocale()
  const ar = locale === 'ar'

  const [issues, setIssues] = useState<CatalogueIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/ops/catalogue-health')
      if (res.status === 401) { router.replace('/admin'); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setIssues(data.issues || [])
    } catch {
      setLoadError(tCommon('loadError'))
    } finally {
      setLoading(false)
    }
  }, [tCommon, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const issueLabel = (code: string) => (
    KNOWN_ISSUE_CODES.includes(code) ? t(`issues.${code}`) : t('issues.other')
  )

  const grouped = issues.reduce<Record<string, CatalogueIssue[]>>((acc, issue) => {
    (acc[issue.type] ??= []).push(issue)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      {loading && (
        <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />{tCommon('loading')}
        </CardContent></Card>
      )}

      {!loading && loadError && (
        <Card><CardContent className="p-8 text-center text-red-500">{loadError}</CardContent></Card>
      )}

      {!loading && !loadError && issues.length === 0 && (
        <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-green-700">
          <CheckCircle2 className="h-5 w-5" />
          {t('empty')}
        </CardContent></Card>
      )}

      {!loading && !loadError && issues.length > 0 && (
        <div className="space-y-4">
          {(Object.keys(grouped) as CatalogueItemType[]).map((type) => (
            <Card key={type}>
              <CardContent className="p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">{t(`types.${type}`)}</h3>
                <ul className="divide-y divide-gray-100">
                  {grouped[type].map((issue) => (
                    <li key={`${issue.type}-${issue.id}-${issue.code}`} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-gray-900">{ar ? issue.title_ar : issue.title_en}</div>
                        <Badge variant="outline" className="mt-1 border-amber-300 text-amber-700">
                          {issueLabel(issue.code)}
                        </Badge>
                      </div>
                      <Link
                        href={dashboardHref(SECTION_BY_TYPE[type])}
                        className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
                      >
                        {t('viewLink')}
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
