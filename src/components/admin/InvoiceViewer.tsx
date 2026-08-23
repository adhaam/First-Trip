'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Download, X, FileText } from 'lucide-react'

interface InvoiceViewerProps {
  bookingId: string
  bookingNumber: string
  locale: 'ar' | 'en'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InvoiceViewer({ bookingId, bookingNumber, locale, open, onOpenChange }: InvoiceViewerProps) {
  const [loading, setLoading] = useState(false)
  const [invoiceHtml, setInvoiceHtml] = useState<string | null>(null)
  const [invoiceType, setInvoiceType] = useState<'request' | 'confirmation'>('request')
  const ar = locale === 'ar'

  const generateInvoice = async (type: 'request' | 'confirmation') => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/bookings/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          type,
          locale,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to generate invoice')
      setInvoiceHtml(data.html)
      setInvoiceType(type)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const downloadInvoice = () => {
    if (!invoiceHtml) return
    const blob = new Blob([invoiceHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `WEEMAP-Invoice-${bookingNumber}-${invoiceType}.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const printInvoice = () => {
    if (!invoiceHtml) return
    const printWindow = window.open('', '', 'height=750,width=1000')
    if (!printWindow) return
    printWindow.document.write(invoiceHtml)
    printWindow.document.close()
    setTimeout(() => printWindow.print(), 250)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {ar ? 'مولد الفواتير' : 'Invoice Generator'}
        </DialogTitle>

        {!invoiceHtml ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              {ar
                ? 'اختر نوع الفاتورة التي تريد إنشاءها:'
                : 'Choose the type of invoice you want to generate:'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => generateInvoice('request')}
                disabled={loading}
                className="h-24 flex-col items-center justify-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="text-xs font-semibold">
                  {ar ? 'فاتورة الطلب' : 'Request Invoice'}
                </span>
                <span className="text-xs text-white/75">
                  {ar ? 'للطلب الأولي' : 'Initial request'}
                </span>
              </Button>
              <Button
                onClick={() => generateInvoice('confirmation')}
                disabled={loading}
                className="h-24 flex-col items-center justify-center gap-2 bg-green-600 hover:bg-green-700"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                <span className="text-xs font-semibold">
                  {ar ? 'فاتورة التأكيد' : 'Confirmation Invoice'}
                </span>
                <span className="text-xs text-white/75">
                  {ar ? 'للحجز المؤكد' : 'Confirmed booking'}
                </span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={downloadInvoice}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {ar ? 'تحميل' : 'Download'}
              </Button>
              <Button
                onClick={printInvoice}
                variant="outline"
                size="sm"
              >
                {ar ? 'طباعة' : 'Print'}
              </Button>
              <Button
                onClick={() => {
                  setInvoiceHtml(null)
                  setInvoiceType('request')
                }}
                variant="outline"
                size="sm"
              >
                {ar ? 'فاتورة أخرى' : 'Another invoice'}
              </Button>
            </div>

            {/* Invoice preview */}
            <div
              className="border border-gray-200 rounded-lg p-4 bg-white max-h-[500px] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: invoiceHtml }}
            />
          </div>
        )}

        <button
          onClick={() => onOpenChange(false)}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          aria-label={ar ? 'إغلاق' : 'Close'}
        >
          <X className="h-4 w-4" />
        </button>
      </DialogContent>
    </Dialog>
  )
}
