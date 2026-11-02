import { documentFilename } from '@/lib/ops/documents-view'

export type DocLocale = 'ar' | 'en'

/** One customer document the Ops Center can render as standalone, printable HTML. */
export type DocumentSpec =
  | { kind: 'quotation'; requestId: string; reference: string; revision?: number }
  | { kind: 'confirmation'; requestId: string; reference: string }
  | {
      kind: 'booking'
      bookingId: string
      bookingType: 'accommodation' | 'trip'
      type: 'provisional_quotation' | 'booking_confirmation'
      reference: string
    }
  | { kind: 'receipt'; paymentId: string; reference: string }

export type LoadedDocument = { html: string; filename: string }

/** A failed document request. `code` is the server's machine code (e.g. availability_not_confirmed). */
export class DocumentError extends Error {
  readonly code: string | null
  readonly status: number

  constructor(status: number, code: string | null, message?: string) {
    super(message || code || 'document_failed')
    this.name = 'DocumentError'
    this.status = status
    this.code = code
  }
}

async function failure(res: Response): Promise<DocumentError> {
  const body = await res.json().catch(() => null) as { code?: unknown; error?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code : null
  const message = typeof body?.error === 'string' ? body.error : undefined
  return new DocumentError(res.status, code, message)
}

/** Fetches the document HTML and works out the file name to download it under. */
export async function loadDocument(spec: DocumentSpec, locale: DocLocale): Promise<LoadedDocument> {
  if (spec.kind === 'booking') {
    const res = await fetch('/api/admin/bookings/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId: spec.bookingId, bookingType: spec.bookingType, type: spec.type, locale }),
    })
    if (!res.ok) throw await failure(res)
    const data = await res.json() as { html: string; documentNumber?: string }
    return {
      html: data.html,
      filename: documentFilename(data.documentNumber || `${spec.reference}-${spec.type === 'booking_confirmation' ? 'confirmation' : 'quotation'}`),
    }
  }

  let url: string
  let fallbackName: string
  if (spec.kind === 'quotation') {
    const revision = spec.revision != null ? `revision=${spec.revision}&` : ''
    url = `/api/admin/trip-requests/${spec.requestId}/quotation?${revision}locale=${locale}`
    fallbackName = spec.revision != null ? `${spec.reference}-quotation-rev${spec.revision}` : `${spec.reference}-quotation`
  } else if (spec.kind === 'confirmation') {
    url = `/api/admin/trip-requests/${spec.requestId}/confirmation?locale=${locale}`
    fallbackName = `${spec.reference}-confirmation`
  } else {
    url = `/api/admin/payments/${spec.paymentId}/receipt?locale=${locale}`
    fallbackName = `${spec.reference}-receipt-${spec.paymentId.slice(0, 8)}`
  }

  const res = await fetch(url)
  if (!res.ok) throw await failure(res)
  const html = await res.text()
  return { html, filename: documentFilename(res.headers.get('x-document-number') || fallbackName) }
}

/** Prints an HTML document through a throw-away hidden iframe. */
export function printHtml(html: string) {
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

export function downloadHtml(html: string, filename: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
