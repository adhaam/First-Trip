import type { QuoteView } from './view'

/** One server answer, tied to the exact payload it priced. */
export type QuoteAnswer = { key: string; quote: QuoteView | null; errorKey: string }

/**
 * What the price panel may show for the selections currently on screen.
 * A quote is only ever shown for the payload it was priced for: a pending
 * change (debouncing or loading) shows "Recalculating…" instead of the old
 * total, and a builder that isn't ready to price shows no total at all —
 * so removing a stay or switching transport can never leave the previous
 * grand total on screen.
 */
export function settledQuote(answer: QuoteAnswer | null, payload: string | null): { quote: QuoteView | null; refreshing: boolean; errorKey: string } {
  if (!payload) return { quote: null, refreshing: false, errorKey: '' }
  if (!answer || answer.key !== payload) return { quote: null, refreshing: true, errorKey: '' }
  return { quote: answer.quote, refreshing: false, errorKey: answer.errorKey }
}

/** True when every displayed line adds up exactly to the displayed total. */
export function quoteReconciles(quote: Pick<QuoteView, 'total' | 'lines'>): boolean {
  const sum = quote.lines.reduce((total, line) => total + line.amount, 0)
  return Math.round(sum * 100) === Math.round(quote.total * 100)
}
