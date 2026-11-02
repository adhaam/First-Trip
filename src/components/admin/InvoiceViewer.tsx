'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Download, X, FileText } from 'lucide-react'
import { isAvailabilityConfirmed } from '@/lib/ops/documents-view'
import { DocumentError, downloadHtml, loadDocument, type DocumentSpec } from '@/components/admin/ops/documentActions'

type BookingDocumentType = 'provisional_quotation' | 'booking_confirmation'

interface InvoiceViewerProps {
  bookingId: string
  bookingNumber: string
  bookingType: 'accommodation' | 'trip'
  locale: 'ar' | 'en'
  /**
   * The booking's current status. When given, Booking Confirmation is disabled (with the reason shown)
   * until availability is confirmed; when omitted the server's 409 is shown inline instead.
   */
  status?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Customer documents for a single booking (the component keeps its legacy file name). */
export function InvoiceViewer({ bookingId, bookingNumber, bookingType, locale, status, open, onOpenChange }: InvoiceViewerProps) {
  const t = useTranslations('documents')
  const tErr = useTranslations('documents.errors')
  const tCommon = useTranslations('ops.common')
  const [loading, setLoading] = useState<BookingDocumentType | null>(null)
  const [documentHtml, setDocumentHtml] = useState<string | null>(null)
  const [filename, setFilename] = useState('')
  const [error, setError] = useState('')
  const previewFrameRef = useRef<HTMLIFrameElement>(null)

  const confirmationLocked = status !== undefined && !isAvailabilityConfirmed(status)

  const generate = async (type: BookingDocumentType) => {
    setLoading(type)
    setError('')
    const spec: DocumentSpec = { kind: 'booking', bookingId, bookingType, type, reference: bookingNumber }
    try {
      const doc = await loadDocument(spec, locale)
      setDocumentHtml(doc.html)
      setFilename(doc.filename)
    } catch (err) {
      const code = err instanceof DocumentError ? err.code : null
      setError(code && tErr.has(code) ? tErr(code) : tErr('generic'))
    } finally {
      setLoading(null)
    }
  }

  const printDocument = () => {
    previewFrameRef.current?.contentWindow?.print()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {t('title')}
        </DialogTitle>

        {!documentHtml ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('chooseDocument')}</p>
            {error && <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-700">{error}</p>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={() => generate('provisional_quotation')}
                disabled={loading !== null}
                className="h-auto min-h-24 flex-col items-center justify-center gap-2 whitespace-normal py-3 text-center"
              >
                {loading === 'provisional_quotation' && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="text-xs font-semibold">{t('names.provisionalQuotation')}</span>
                <span className="text-xs font-normal text-white/75">{t('when.provisionalQuotation')}</span>
              </Button>
              <div className="flex flex-col gap-1">
                <Button
                  onClick={() => generate('booking_confirmation')}
                  disabled={loading !== null || confirmationLocked}
                  className="h-auto min-h-24 flex-col items-center justify-center gap-2 whitespace-normal bg-green-600 py-3 text-center hover:bg-green-700"
                >
                  {loading === 'booking_confirmation' && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span className="text-xs font-semibold">{t('names.bookingConfirmation')}</span>
                  <span className="text-xs font-normal text-white/75">{t('when.bookingConfirmation')}</span>
                </Button>
                {confirmationLocked && <p className="text-xs text-amber-800">{t('confirmationLocked')}</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={() => downloadHtml(documentHtml, filename)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {t('download')}
              </Button>
              <Button onClick={printDocument} variant="outline" size="sm">
                {t('print')}
              </Button>
              <Button
                onClick={() => {
                  setDocumentHtml(null)
                  setFilename('')
                  setError('')
                }}
                variant="outline"
                size="sm"
              >
                {t('another')}
              </Button>
            </div>

            <iframe
              ref={previewFrameRef}
              title={t('previewTitle')}
              srcDoc={documentHtml}
              sandbox="allow-same-origin allow-modals"
              className="h-[500px] w-full rounded-lg border border-gray-200 bg-white"
            />
          </div>
        )}

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label={tCommon('close')}
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  )
}
