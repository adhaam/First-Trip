const CAIRO_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Africa/Cairo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Returns the current date in the Africa/Cairo timezone as an ISO date
 * string (YYYY-MM-DD). WEEMAP operates in Egypt (UTC+2/+3), so this must be
 * used instead of `new Date().toISOString().slice(0, 10)` (UTC date) for any
 * "today" used in booking/schedule logic — otherwise "today" flips to
 * yesterday between local midnight and ~03:00.
 */
export function todayInCairo(now: Date = new Date()): string {
  return CAIRO_DATE_FORMATTER.format(now)
}
