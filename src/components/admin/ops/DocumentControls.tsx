'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, Eye, Loader2, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DocumentError,
  downloadHtml,
  loadDocument,
  printHtml,
  type DocLocale,
  type DocumentSpec,
} from '@/components/admin/ops/documentActions'

/** Maps a failed document request to a plain-language message. */
function useDocumentErrorText() {
  const t = useTranslations('documents.errors')
  return (err: unknown): string => {
    const code = err instanceof DocumentError ? err.code : null
    if (code && t.has(code)) return t(code)
    if (err instanceof DocumentError && err.status === 404) return t('not_found')
    return t('generic')
  }
}

/** AR / EN switch for the language a customer document is rendered in. */
export function DocLanguageToggle({ value, onChange }: { value: DocLocale; onChange: (next: DocLocale) => void }) {
  const t = useTranslations('documents')
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

/** View / Print / Download for one document. Print and Download fetch on demand; failures show inline. */
export function DocumentActionButtons({ spec, docLocale, onView, disabled }: {
  spec: DocumentSpec
  docLocale: DocLocale
  /** Opens the shared viewer for this document. */
  onView: (spec: DocumentSpec) => void
  disabled?: boolean
}) {
  const t = useTranslations('documents')
  const errorText = useDocumentErrorText()
  const [busy, setBusy] = useState<'print' | 'download' | null>(null)
  const [error, setError] = useState('')

  const run = async (action: 'print' | 'download') => {
    setBusy(action)
    setError('')
    try {
      const doc = await loadDocument(spec, docLocale)
      if (action === 'print') printHtml(doc.html)
      else downloadHtml(doc.html, doc.filename)
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={disabled || busy !== null} onClick={() => onView(spec)}>
          <Eye className="me-1" />
          {t('view')}
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || busy !== null} onClick={() => run('print')}>
          {busy === 'print' ? <Loader2 className="me-1 animate-spin" /> : <Printer className="me-1" />}
          {t('print')}
        </Button>
        <Button size="sm" variant="outline" disabled={disabled || busy !== null} onClick={() => run('download')}>
          {busy === 'download' ? <Loader2 className="me-1 animate-spin" /> : <Download className="me-1" />}
          {t('download')}
        </Button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
  )
}

type ViewerState = { html: string | null; filename: string; loading: boolean; error: string }

/**
 * Preview dialog for one customer document, with a language toggle plus Print and Download.
 * Closed while `spec` is null; the document is re-fetched whenever the spec or language changes.
 */
export function DocumentViewerDialog({ spec, title, docLocale, onDocLocaleChange, onClose }: {
  spec: DocumentSpec | null
  title: string
  docLocale: DocLocale
  onDocLocaleChange: (next: DocLocale) => void
  onClose: () => void
}) {
  const t = useTranslations('documents')
  const errorText = useDocumentErrorText()
  const [state, setState] = useState<ViewerState>({ html: null, filename: '', loading: false, error: '' })

  useEffect(() => {
    if (!spec) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the viewer while the document reloads
    setState({ html: null, filename: '', loading: true, error: '' })
    loadDocument(spec, docLocale)
      .then((doc) => { if (!cancelled) setState({ html: doc.html, filename: doc.filename, loading: false, error: '' }) })
      .catch((err) => { if (!cancelled) setState({ html: null, filename: '', loading: false, error: errorText(err) }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- errorText only wraps the translator
  }, [spec, docLocale])

  return (
    <Dialog open={spec !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader className="pe-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('viewerHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <DocLanguageToggle value={docLocale} onChange={onDocLocaleChange} />
          <Button size="sm" variant="outline" disabled={!state.html} onClick={() => state.html && printHtml(state.html)}>
            <Printer className="me-1" />
            {t('print')}
          </Button>
          <Button size="sm" variant="outline" disabled={!state.html} onClick={() => state.html && downloadHtml(state.html, state.filename)}>
            <Download className="me-1" />
            {t('download')}
          </Button>
        </div>
        {state.loading && (
          <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </p>
        )}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {state.html && (
          <iframe
            title={title}
            srcDoc={state.html}
            sandbox="allow-same-origin allow-modals"
            className="min-h-0 w-full flex-1 rounded-lg border border-gray-200 bg-white"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
