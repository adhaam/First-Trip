// ─── HTML / JSON-LD output escaping ───
//
// The single place stored or user-supplied text is made safe to splice into
// markup built as a string. Anything that reaches an HTML string from the
// database — a customer name typed into the public booking form, notes,
// site_settings text — goes through escapeHtml() (or escapeHtmlMultiline()).
// Anything serialised into a <script type="application/ld+json"> tag goes
// through jsonLdScript(), so a stored `</script>` can never close the tag.

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escape a value for use as HTML text or inside a quoted attribute.
 * null / undefined render as the empty string (never the word "undefined").
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch])
}

/**
 * Escape, then turn line breaks into <br> so multi-line free text (booking
 * notes, terms) keeps its formatting. The escaping happens first, so the only
 * markup this can ever emit is the <br> it adds itself.
 */
export function escapeHtmlMultiline(value: unknown): string {
  return escapeHtml(value).replace(/\r\n|\r|\n/g, '<br>')
}

/**
 * Serialise a value for the body of a <script type="application/ld+json">.
 *
 * JSON.stringify alone is NOT safe there: a string containing `</script>`
 * ends the script element and whatever follows is parsed as HTML. `<`, `>`
 * and `&` are emitted as JSON unicode escapes (still valid JSON, identical
 * value once parsed), as are U+2028/U+2029, which some JS parsers treat as
 * line terminators.
 */
// Built from code points so no raw separator character sits in this source.
const JSON_LD_UNSAFE = new RegExp('[<>&' + String.fromCharCode(0x2028, 0x2029) + ']', 'g')

export function jsonLdScript(value: unknown): string {
  return (JSON.stringify(value) ?? 'null').replace(
    JSON_LD_UNSAFE,
    (ch) => '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0'),
  )
}
