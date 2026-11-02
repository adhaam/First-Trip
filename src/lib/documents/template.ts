/**
 * The ONE branded template shared by every customer document: the provisional
 * quotation, the booking confirmation & payment request and the payment
 * receipt. Each document builds its own body from the fragment helpers below;
 * the page frame (logo, title, number, banners, contact footer, print CSS) is
 * identical, so the three can never drift apart in look or in legal wording.
 *
 * Pure (no server imports). Everything dynamic is escaped here — callers pass
 * plain text, or `{ html }` for a fragment they built with these helpers.
 *
 * Brand: the sea / sun / sand palette and ink colours from src/app/globals.css.
 * The logo is the official artwork embedded as a data: URI (see logo-data.ts)
 * so it renders in downloaded, printed and PDF copies with no network access.
 */
import { EMAIL, PHONE_NUMBER, WHATSAPP_NUMBER } from '@/lib/constants'
import { escapeHtml as esc, escapeHtmlMultiline as escLines } from '@/lib/safe-html'
import type { SiteSettings } from '@/lib/types'
import { notTaxInvoice, type DocLocale, type DocumentKind } from './format'
import { DOCUMENT_LOGO_DATA_URI, DOCUMENT_LOGO_HEIGHT, DOCUMENT_LOGO_WIDTH } from './logo-data'

/** Plain text (escaped on render) or an already-safe fragment built with this module's helpers. */
export type Cell = string | number | { html: string }

function cell(value: Cell): string {
  return typeof value === 'object' ? value.html : esc(value)
}

// ─── Contact (same sources as the site footer) ───

export type DocumentContact = {
  whatsapp: string
  phone: string
  email: string
  website: string
  location: string
}

const WEBSITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://weemapsinai.com'

/**
 * Official contact details: the admin-managed site_settings row, falling back
 * to the constants the public footer itself falls back to.
 */
export function resolveContact(settings: SiteSettings | null | undefined, locale: DocLocale): DocumentContact {
  return {
    whatsapp: settings?.whatsapp_number || WHATSAPP_NUMBER,
    phone: settings?.phone_number || PHONE_NUMBER,
    email: settings?.email || EMAIL,
    website: WEBSITE_URL.replace(/^https?:\/\//, '').replace(/\/+$/, ''),
    location: settings?.location || (locale === 'ar' ? 'دهب، جنوب سيناء' : 'Dahab, South Sinai'),
  }
}

// ─── Fragments ───

export function section(heading: string, inner: string): string {
  return `<section class="block"><h2>${esc(heading)}</h2>${inner}</section>`
}

/** Label / value pairs (customer, journey facts, payment facts). */
export function kvTable(rows: Array<[string, Cell]>): string {
  const body = rows
    .map(([label, value]) => `<tr><th>${esc(label)}</th><td>${cell(value)}</td></tr>`)
    .join('')
  return `<table class="kv">${body}</table>`
}

export type ChargeRow = {
  description: string
  /** Secondary line under the description, e.g. "5 people x 950 EGP". */
  meta?: string
  quantity?: number | string
  unit?: string
  total: string
}

/** Itemised charges. With `showQuantity` the Qty / Price columns are shown (legacy bookings). */
export function chargesTable(
  headings: { description: string; quantity: string; unit: string; total: string },
  rows: ChargeRow[],
  showQuantity: boolean,
): string {
  const head = `<thead><tr><th>${esc(headings.description)}</th>`
    + (showQuantity ? `<th class="qty">${esc(headings.quantity)}</th><th class="num">${esc(headings.unit)}</th>` : '')
    + `<th class="num">${esc(headings.total)}</th></tr></thead>`
  const body = rows
    .map((row) => {
      const meta = row.meta ? `<span class="meta">${esc(row.meta)}</span>` : ''
      return `<tr><td>${esc(row.description)}${meta}</td>`
        + (showQuantity
          ? `<td class="qty">${esc(row.quantity ?? '')}</td><td class="num">${esc(row.unit ?? '')}</td>`
          : '')
        + `<td class="num"><strong>${esc(row.total)}</strong></td></tr>`
    })
    .join('')
  return `<table class="lines">${head}<tbody>${body}</tbody></table>`
}

export type SummaryRow = {
  label: string
  value: string
  /** total = agreed total line; due = highlighted amount; muted = secondary; credit = deduction. */
  tone?: 'total' | 'due' | 'muted' | 'credit'
}

export function summaryTable(rows: SummaryRow[]): string {
  const body = rows
    .map((row) => `<tr class="${row.tone ?? ''}"><td>${esc(row.label)}</td><td class="num">${esc(row.value)}</td></tr>`)
    .join('')
  return `<table class="summary">${body}</table>`
}

export type CalloutTone = 'info' | 'success' | 'provisional' | 'superseded'

export function callout(tone: CalloutTone, heading: string | null, text: string): string {
  return `<div class="callout ${tone}">${heading ? `<strong>${esc(heading)}</strong>` : ''}${escLines(text)}</div>`
}

export function paragraphs(text: string): string {
  return `<p class="prose">${escLines(text)}</p>`
}

export function bulletList(items: string[]): string {
  return `<ul class="list">${items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
}

// ─── Frame ───

export type DocBanner = { tone: CalloutTone; text: string }

export type DocumentFrame = {
  locale: DocLocale
  kind: DocumentKind
  /** The visible document title ("Provisional Quotation", ...). Never "Invoice". */
  title: string
  documentNumber: string
  /** Issue date, already formatted in Africa/Cairo. */
  issueDate: string
  issueDateLabel: string
  /** Extra header lines under the number, e.g. Reference / Revision. */
  meta?: Array<[string, string]>
  banners?: DocBanner[]
  /** Trusted HTML assembled from this module's fragment helpers. */
  body: string
  contact: DocumentContact
}

const TAGLINE = { en: 'Trips & stays in Dahab and Sinai', ar: 'رحلات وإقامة في دهب وسيناء' }

const STYLES = `
    :root {
      --sea-50: #EEF8FA; --sea-100: #DAEEF3; --sea-500: #1D86A3; --sea-600: #146D89; --sea-700: #155D68;
      --sun-100: #FCEBCB; --sun-400: #EA9A3E; --sun-500: #D97F22; --sun-700: #8F4C12; --sun-800: #6B380B;
      --sand-50: #FBF7F0; --sand-100: #F6EEDE; --sand-200: #EEE1C6; --sand-300: #DFCBA0;
      --ink: #1A1B18; --ink-muted: #5A5852; --charcoal: #141310; --cream: #F7F4EE; --danger: #8B1E1E;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', Almarai, 'Segoe UI', Tahoma, Arial, sans-serif; color: var(--ink);
      line-height: 1.6; background: var(--sand-100); padding: 24px 16px; font-size: 14px; }
    .page { max-width: 820px; margin: 0 auto; background: #fff; border: 1px solid var(--sand-200);
      border-radius: 14px; padding: 36px; box-shadow: 0 2px 10px rgba(26, 27, 24, .08); }
    .masthead { display: flex; justify-content: space-between; align-items: flex-start; gap: 20px;
      padding-bottom: 18px; border-bottom: 3px solid var(--sun-400); margin-bottom: 22px; }
    .brand { display: inline-flex; align-items: center; background: var(--charcoal); color: var(--cream);
      border-radius: 12px; padding: 8px 12px; font-weight: 800; letter-spacing: .04em; min-height: 44px; }
    .brand img { display: block; height: 44px; width: auto; }
    .tagline { margin-top: 8px; color: var(--ink-muted); font-size: 12px; }
    .docmeta { text-align: end; font-size: 13px; color: var(--ink-muted); }
    .docmeta .doctitle { display: inline-block; background: var(--sea-600); color: #fff; font-weight: 700;
      font-size: 15px; padding: 6px 14px; border-radius: 8px; margin-bottom: 8px; }
    .docmeta .docnumber { color: var(--ink); font-weight: 700; direction: ltr; unicode-bidi: isolate; }
    .docmeta div { margin-top: 2px; }
    .callout { padding: 12px 16px; border-radius: 10px; margin-bottom: 14px; font-size: 13.5px; border: 1px solid; }
    .callout strong { display: block; margin-bottom: 4px; font-size: 14px; }
    .callout.info { background: var(--sea-50); border-color: var(--sea-100); color: var(--sea-700); }
    .callout.success { background: #EAF6EE; border-color: #BFE2CB; color: #1E5B34; }
    .callout.provisional { background: var(--sun-100); border: 2px solid var(--sun-500); color: var(--sun-800);
      font-weight: 700; }
    .callout.superseded { background: #FDE8E8; border: 2px solid #C62828; color: #7F1D1D; font-weight: 700; }
    .block { margin-top: 22px; break-inside: avoid; }
    h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: var(--sea-600);
      margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--sand-200); }
    table { width: 100%; border-collapse: collapse; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    table.kv th { text-align: start; width: 36%; font-weight: 600; color: var(--ink-muted); padding: 5px 0;
      vertical-align: top; }
    table.kv td { padding: 5px 0; }
    table.lines thead { display: table-header-group; background: var(--sand-50); }
    table.lines th { padding: 9px 10px; text-align: start; font-size: 12px; color: var(--ink-muted);
      border-top: 2px solid var(--sun-400); border-bottom: 1px solid var(--sand-300); }
    table.lines td { padding: 9px 10px; border-bottom: 1px solid var(--sand-200); text-align: start;
      vertical-align: top; }
    table.lines .meta { display: block; font-size: 11.5px; color: var(--ink-muted); margin-top: 2px; }
    .qty { text-align: center !important; white-space: nowrap; }
    .num, td.num, th.num { text-align: end !important; white-space: nowrap; direction: ltr; unicode-bidi: isolate;
      font-variant-numeric: tabular-nums; }
    table.summary { margin-top: 14px; margin-inline-start: auto; width: 62%; min-width: 280px; }
    table.summary td { padding: 7px 8px; border-bottom: 1px solid var(--sand-200); }
    table.summary tr.total td { font-weight: 800; font-size: 16px; border-top: 2px solid var(--ink);
      border-bottom: 1px solid var(--sand-300); }
    table.summary tr.due td { font-weight: 800; font-size: 16px; background: var(--sun-100);
      border-top: 2px solid var(--sun-500); border-bottom: 2px solid var(--sun-500); color: var(--sun-800); }
    table.summary tr.muted td { color: var(--ink-muted); }
    table.summary tr.credit td.num { color: #15803D; }
    .prose { font-size: 12.5px; color: var(--ink-muted); line-height: 1.8; }
    ul.list { padding-inline-start: 20px; font-size: 13px; color: var(--ink); }
    ul.list li { margin: 3px 0; }
    .terms { background: var(--sand-50); border: 1px solid var(--sand-200); border-radius: 10px; padding: 14px 16px; }
    .footer { margin-top: 30px; padding-top: 14px; border-top: 3px solid var(--sun-400); text-align: center;
      font-size: 12px; color: var(--ink-muted); }
    .footer .legal { margin-top: 8px; font-weight: 700; color: var(--ink); }
    .footer .ltr { direction: ltr; unicode-bidi: isolate; display: inline-block; }
    @page { size: A4; margin: 14mm; }
    @media (max-width: 600px) {
      .page { padding: 20px; }
      .masthead { flex-direction: column; }
      .docmeta { text-align: start; }
      table.summary { width: 100%; }
    }
    @media print {
      body { background: #fff; padding: 0; }
      .page { box-shadow: none; border: 0; border-radius: 0; padding: 0; max-width: none; }
      .brand, .docmeta .doctitle, .callout, table.summary tr.due td, table.lines thead {
        -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  `

/** Renders the complete standalone HTML document. */
export function renderDocument(frame: DocumentFrame): string {
  const ar = frame.locale === 'ar'
  const c = frame.contact
  const metaLines = (frame.meta ?? [])
    .map(([label, value]) => `<div>${esc(label)}: <strong>${esc(value)}</strong></div>`)
    .join('')
  const banners = (frame.banners ?? [])
    .map((banner) => `<div class="callout ${banner.tone}" role="alert">${escLines(banner.text)}</div>`)
    .join('')
  const contactLine = [
    `${ar ? 'واتساب' : 'WhatsApp'}: <span class="ltr">${esc(c.whatsapp)}</span>`,
    `${ar ? 'الهاتف' : 'Phone'}: <span class="ltr">${esc(c.phone)}</span>`,
    `${ar ? 'البريد الإلكتروني' : 'Email'}: <span class="ltr">${esc(c.email)}</span>`,
  ].join(' &nbsp;|&nbsp; ')

  return `<!DOCTYPE html>
<html lang="${ar ? 'ar' : 'en'}" dir="${ar ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(frame.title)} ${esc(frame.documentNumber)}</title>
  <style>${STYLES}</style>
</head>
<body>
  <div class="page">
    <header class="masthead">
      <div>
        <div class="brand"><img src="${DOCUMENT_LOGO_DATA_URI}" alt="WEEMAP SINAI" width="${DOCUMENT_LOGO_WIDTH}" height="${DOCUMENT_LOGO_HEIGHT}"></div>
        <div class="tagline">${esc(ar ? TAGLINE.ar : TAGLINE.en)}</div>
      </div>
      <div class="docmeta">
        <div class="doctitle">${esc(frame.title)}</div>
        <div>${esc(ar ? 'رقم المستند' : 'Document no.')}: <span class="docnumber">${esc(frame.documentNumber)}</span></div>
        ${metaLines}
        <div>${esc(frame.issueDateLabel)}: <strong>${esc(frame.issueDate)}</strong></div>
      </div>
    </header>
    ${banners}
    ${frame.body}
    <footer class="footer">
      <div><strong>WEEMAP SINAI</strong> &middot; ${esc(c.location)}</div>
      <div>${contactLine}</div>
      <div><span class="ltr">${esc(c.website)}</span></div>
      <div class="legal">${esc(notTaxInvoice(frame.locale))}</div>
    </footer>
  </div>
</body>
</html>`
}
