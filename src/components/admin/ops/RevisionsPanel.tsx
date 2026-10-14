'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Eye, Loader2, Printer, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAmount } from '@/lib/format'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'

type DocLocale = 'ar' | 'en'

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

type ViewerState = { revision: number; html: string | null; loading: boolean; error: boolean }

const FIRM_STATUSES = ['awaiting_payment', 'confirmed', 'completed']

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

/** Prints an HTML document through a throw-away hidden iframe. */
function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;inset-inline-end:0;bottom:0;width:0;height:0;border:0;'
  const cleanup = () => window.setTimeout(() => frame.remove(), 1000)
  frame.onload = () => {
    try {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
    } finally {
      cleanup()
    }
  }
  frame.srcdoc = html
  document.body.appendChild(frame)
}

function downloadHtml(html: string, filename: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function LanguageToggle({ value, onChange }: { value: DocLocale; onChange: (next: DocLocale) => void }) {
  const t = useTranslations('ops.amend.revisions')
  return (
    <div role="group" aria-label={t('language')} className="inline-flex items-center gap-1">
      <span className="text-xs text-muted-foreground">{t('language')}</span>
      {(['ar', 'en'] as const).map((code) => (
        <Button
          key={code}
          type="button"
          size="xs"
          variant={value === code ? 'default' : 'outline'}
          aria-pressed={value === code}
          onClick={() => onChange(code)}
        >
          {code === 'ar' ? t('arabic') : t('english')}
        </Button>
      ))}
    </div>
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
  const fetchJson = useOpsFetch()

  const [revisions, setRevisions] = useState<JourneyRevision[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [docLocale, setDocLocale] = useState<DocLocale>(locale === 'en' ? 'en' : 'ar')
  const [busy, setBusy] = useState<string | null>(null)
  const [docError, setDocError] = useState('')
  const [viewer, setViewer] = useState<ViewerState | null>(null)

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

  const fetchQuotation = useCallback(async (revision: number, language: DocLocale): Promise<string> => {
    const res = await fetch(`/api/admin/trip-requests/${requestId}/quotation?revision=${revision}&locale=${language}`)
    if (!res.ok) throw new Error('quotation_failed')
    return res.text()
  }, [requestId])

  // Re-fetch the open document when the language toggle changes.
  const viewerRevision = viewer?.revision
  useEffect(() => {
    if (viewerRevision == null) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the viewer while the document reloads
    setViewer((current) => current && { ...current, html: null, loading: true, error: false })
    fetchQuotation(viewerRevision, docLocale)
      .then((html) => { if (!cancelled) setViewer((current) => current && { ...current, html, loading: false }) })
      .catch(() => { if (!cancelled) setViewer((current) => current && { ...current, loading: false, error: true }) })
    return () => { cancelled = true }
  }, [viewerRevision, docLocale, fetchQuotation])

  const openViewer = (revision: number) => {
    setViewer({ revision, html: null, loading: true, error: false })
  }

  const run = async (revision: number, action: 'print' | 'download') => {
    setBusy(`${action}:${revision}`)
    setDocError('')
    try {
      const html = await fetchQuotation(revision, docLocale)
      if (action === 'print') printHtml(html)
      else downloadHtml(html, `${reference}-rev${revision}.html`)
    } catch {
      setDocError(t('docError'))
    } finally {
      setBusy(null)
    }
  }

  const statusLabel = (status: string) => (tStatus.has(status) ? tStatus(status) : status)

  const formatWhen = (value: string) => new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG' : 'en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))

  return (
    <section className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">{t('title')}</h2>
        <LanguageToggle value={docLocale} onChange={setDocLocale} />
      </div>

      {docError && <p role="alert" className="mb-2 text-sm text-red-700">{docError}</p>}

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
            const provisional = !revision.status_at_revision || !FIRM_STATUSES.includes(revision.status_at_revision)
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
                  {provisional && (
                    <Badge variant="outline" className="border-amber-400 text-amber-800">{t('provisional')}</Badge>
                  )}
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
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openViewer(revision.revision_number)}
                  >
                    <Eye className="me-1" />
                    {t('view')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => run(revision.revision_number, 'print')}
                  >
                    {busy === `print:${revision.revision_number}`
                      ? <Loader2 className="me-1 animate-spin" />
                      : <Printer className="me-1" />}
                    {t('print')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => run(revision.revision_number, 'download')}
                  >
                    {busy === `download:${revision.revision_number}`
                      ? <Loader2 className="me-1 animate-spin" />
                      : <Download className="me-1" />}
                    {t('download')}
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog open={viewer !== null} onOpenChange={(open) => { if (!open) setViewer(null) }}>
        <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader className="pe-10">
            <DialogTitle>{t('quotationTitle', { reference, n: viewer?.revision ?? 0 })}</DialogTitle>
            <DialogDescription>{t('quotationHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageToggle value={docLocale} onChange={setDocLocale} />
            <Button
              size="sm"
              variant="outline"
              disabled={!viewer?.html}
              onClick={() => viewer?.html && printHtml(viewer.html)}
            >
              <Printer className="me-1" />
              {t('print')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!viewer?.html}
              onClick={() => viewer?.html && downloadHtml(viewer.html, `${reference}-rev${viewer.revision}.html`)}
            >
              <Download className="me-1" />
              {t('download')}
            </Button>
          </div>
          {viewer?.loading && (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('loadingDoc')}
            </p>
          )}
          {viewer?.error && <p role="alert" className="text-sm text-red-700">{t('docError')}</p>}
          {viewer?.html && (
            <iframe
              title={t('quotationTitle', { reference, n: viewer.revision })}
              srcDoc={viewer.html}
              sandbox="allow-same-origin allow-modals"
              className="min-h-0 w-full flex-1 rounded-lg border border-gray-200 bg-white"
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}
