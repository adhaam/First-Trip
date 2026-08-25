// Shared server + client validation helpers.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** Long runs of hex-only characters (8+) look like a stray id, not a name. */
const HEX_ID_RE = /^[0-9a-f]{8,}$/i

/**
 * True if a display name looks like a raw UUID/hex id rather than a
 * human-written name — guards against a bad import or copy/paste leaving an
 * id in the name field, which then leaks into admin dropdowns and public
 * URLs (see 2026-08 "trip name is really bad" report).
 */
export function looksLikeRawId(value: string): boolean {
  const v = value.trim()
  if (!v) return false
  return UUID_RE.test(v) || HEX_ID_RE.test(v)
}

export const NOT_RAW_ID_MESSAGE =
  'This looks like a raw ID, not a name. Please enter a real, human-readable name.'
