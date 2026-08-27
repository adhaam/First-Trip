/**
 * Small client-side CSV helpers shared by admin managers that export the
 * currently-loaded/filtered list to a file (no server round-trip).
 */

/** Escapes a single cell per RFC 4180 (quote-wrap, double internal quotes). */
function escapeCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`
}

/** Builds a CSV string (with header row) from an array of row arrays. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n')
}

/** Triggers a browser download of `csv` as a UTF-8 file (BOM for Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
