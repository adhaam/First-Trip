import { NextResponse } from 'next/server'

/**
 * Headers for every customer-document response. The HTML is fully self-contained
 * (inline CSS, the logo as a data: URI), so nothing may load from anywhere else:
 * img-src data: is the only external allowance, and no script can run.
 */
export const DOCUMENT_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"

export const DOCUMENT_HEADERS = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'content-security-policy': DOCUMENT_CSP,
} as const

/** A standalone printable HTML document. */
export function documentHtmlResponse(html: string): NextResponse {
  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', ...DOCUMENT_HEADERS },
  })
}

/** A JSON error / payload with the same private, uncached, locked-down headers. */
export function documentJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { ...DOCUMENT_HEADERS } })
}
