'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/format'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import type { DocLocale, DocumentSpec } from '@/components/admin/ops/documentActions'
import { DocLanguageToggle, DocumentActionButtons, DocumentViewerDialog } from '@/components/admin/ops/DocumentControls'

export type JourneyRevision = {
  revision_number: number
  kind: 'original' | 'amendment'
  created_at: string
  created_by: string | null
  quoted_total: number | null
  previous_total: number | null
  difference: number | null
  reason: string | null
  status_at_revision: string | null
  availability_confirmed: boolean
  is_current: boolean
}

function Money({ value, signed }: { value: number | null | undefined; signed?: boolean }) {
  const locale = useLocale()
  const tCommon = useTranslations('ops.common')
  if (value == null) return <span>{tCommon('none')}</span>
  const sign = signed ? (value > 0 ? '+' : value < 0 ? '−' : '') : ''
  return (
    <span dir="ltr" className="whitespace-nowrap tabular-nums">
      {sign}
      {formatAmount(Math.abs(value), locale)} {tCommon('egp')}
    </span>
  )
}

/** Revision history of a Build-Your-Trip journey with view / print / download of each versioned quotation. */
export function RevisionsPanel({ requestId, reference, refreshKey = 0 }: {
  requestId: string
  reference: string
  /** Bump to reload after an amendment. */
  refreshKey?: number
}) {
  const locale = useLocale()
  const t = useTranslations('ops.amend.revisions')
  const tStatus = useTranslations('ops.status')
  const tDoc = useTranslations('documents')
  const fetchJson = useOpsFetch()

  const [revisions, setRevisions] = useState<JourneyRevision[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [docLocale, setDocLocale] = useState<DocLocale>(locale === 'en' ? 'en' : 'ar')
  const [viewing, setViewing] = useState<{ spec: DocumentSpec; title: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res: { revisions: JourneyRevision[] } = await fetchJson(`/api/admin/trip-requests/${requestId}/revisions`)
      setRevisions([...(res.revisions ?? [])].sort((a, b) => b.revision_number - a.revision_number))
    } catch (err) {
      if (err instanceof Error && err.message !== 'unauthorized') setError(true)
    } finally {
      setLoading(false)
    }
  }, [requestId, fetchJson])

  useEffect(() => { // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load, refreshKey])

  const quotationName = (revision: JourneyRevision) => (
    revision.is_current ? tDoc('names.provisionalQuotation') : tDoc('names.supersededQuotation')
  )

  const statusLabel = (status: string) => (tStatus.has(status) ? tStatus(status) : status)

  const formatWhen = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <DocLanguageToggle value={docLocale} onChange={setDocLocale} />
      </div>

      {loading && !revisions && <Skeleton className="h-20 rounded-lg" />}

      {error && (
        <div className="flex items-center justify-between gap-3 text-sm text-red-700">
          <span role="alert">{t('loadError')}</span>
          <Button variant="outline" size="sm" onClick={load}>
            <RotateCcw className="me-2 h-4 w-4" />
            {t('retry')}
          </Button>
        </div>
      )}

      {revisions && revisions.length === 0 && <p className="text-sm text-muted-foreground">{t('empty')}</p>}

      {revisions && revisions.length > 0 && (
        <ul className="flex flex-col divide-y">
          {revisions.map((revision) => {
            const diff = revision.difference
            const tone = diff == null || diff === 0 ? 'text-gray-600' : diff > 0 ? 'text-red-700' : 'text-green-700'
            return (
              <li key={revision.revision_number} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{t('revision', { n: revision.revision_number })}</span>
                  <Badge variant="outline">{revision.kind === 'original' ? t('original') : t('amendment')}</Badge>
                  {revision.is_current
                    ? <Badge variant="default">{t('current')}</Badge>
                    : <Badge variant="secondary">{t('superseded')}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatWhen(revision.created_at)}
                  {revision.created_by ? ` · ${t('by', { name: revision.created_by })}` : ''}
                  {revision.status_at_revision ? ` · ${statusLabel(revision.status_at_revision)}` : ''}
                </p>
                <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span>{t('total')}: <Money value={revision.quoted_total} /></span>
                  {revision.kind === 'amendment' && (
                    <span className={tone}>{t('difference')}: <Money value={diff} signed /></span>
                  )}
                </p>
                {revision.reason && (
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{t('reason')}: </span>
                    {revision.reason}
                  </p>
                )}
                <p className="text-sm font-medium">{quotationName(revision)}</p>
                <DocumentActionButtons
                  spec={{ kind: 'quotation', requestId, reference, revision: revision.revision_number }}
                  docLocale={docLocale}
                  onView={(spec) => setViewing({
                    spec,
                    title: tDoc('revisions.viewerTitle', { name: quotationName(revision), reference, n: revision.revision_number }),
                  })}
                />
              </li>
            )
          })}
        </ul>
      )}

      <DocumentViewerDialog
        spec={viewing?.spec ?? null}
        title={viewing?.title ?? ''}
        docLocale={docLocale}
        onDocLocaleChange={setDocLocale}
        onClose={() => setViewing(null)}
      />
    </section>
  )
}
