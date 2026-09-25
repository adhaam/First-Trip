'use client'

// GET /api/admin/transport (docs/m3/OPS_API_CONTRACT.md, "Transport configuration").
// Two clearly separated panels: TransportOperatingSchedule (when services run) and
// TransportStayPatterns (what WEEMAP sells) — never merged, per the M3 build brief.

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Loader2, RotateCcw } from 'lucide-react'
import { useStaff } from '@/components/admin/ops/StaffContext'
import type { TransportData } from './transport-types'
import { TransportOperatingSchedule } from './TransportOperatingSchedule'
import { TransportStayPatterns } from './TransportStayPatterns'

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      const error = new Error(data.error || 'Request failed') as Error & { code?: string; details?: unknown }
      error.code = data.code
      error.details = data.details
      throw error
    }
    return data
  }, [locale])
}

export function TransportScheduleManager() {
  const t = useTranslations('opsConfig.transport')
  const tCommon = useTranslations('opsConfig.common')
  const api = useAdminFetch()
  const { capabilities } = useStaff()
  const canWrite = capabilities.manageCatalogue

  const [data, setData] = useState<TransportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const result = await api('/api/admin/transport')
      setData(result as unknown as TransportData)
    } catch (e) {
      if ((e as Error).message !== 'unauthorized') setLoadError(tCommon('loadError'))
    } finally {
      setLoading(false)
    }
  }, [api, tCommon])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={load} disabled={loading}>
          <RotateCcw className="h-3.5 w-3.5" />
          {tCommon('retry')}
        </Button>
      </div>

      {loading && !data && (
        <Card><CardContent className="flex items-center justify-center gap-2 p-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />{tCommon('loading')}
        </CardContent></Card>
      )}

      {!loading && loadError && !data && (
        <Card><CardContent className="p-8 text-center text-red-500">{loadError}</CardContent></Card>
      )}

      {data && (
        <Tabs defaultValue="schedule">
          <TabsList>
            <TabsTrigger value="schedule">{t('tabs.schedule')}</TabsTrigger>
            <TabsTrigger value="patterns">{t('tabs.patterns')}</TabsTrigger>
          </TabsList>
          <TabsContent value="schedule">
            <TransportOperatingSchedule data={data} canWrite={canWrite} api={api} onRefetch={load} />
          </TabsContent>
          <TabsContent value="patterns">
            <TransportStayPatterns data={data} canWrite={canWrite} api={api} onRefetch={load} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
