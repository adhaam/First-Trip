/**
 * Arabic-aware normalisation for the public search box (M3 Discovery).
 *
 * LIMIT (documented, not solved): the DB columns being searched
 * (name_ar/title_ar/description_ar/...) hold whatever spelling an operator
 * typed — they are NOT normalised at write time, and this migration set
 * intentionally does not add generated/normalised columns for search (out
 * of scope for the Discovery track's one migration, 037, which is about
 * community links). So true DB-side normalised matching is not possible
 * with a plain PostgREST `ilike`. What this module CAN do or without a
 * schema change: normalise the QUERY the same way a human would casually
 * type it, then search with a small set of literal spelling variants
 * OR'd together, so a query typed with tashkeel, tatweel, or the common
 * أ/إ/آ↔ا, ى↔ي, ة↔ه interchanges still matches a differently-spelled
 * column. This is a heuristic, not a guarantee — a query using an
 * unusual variant not covered by `ARABIC_LETTER_VARIANTS` can still miss.
 */

// Arabic diacritics (tashkeel/harakat) + tatweel (kashida) — purely
// decorative marks that change how a word LOOKS, never what it says.
const DIACRITICS_AND_TATWEEL = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۨ-ۭـ]/g

/** Strips tashkeel/harakat and tatweel — text stays the same word, just undecorated. */
export function stripArabicDiacritics(value: string): string {
  return value.replace(DIACRITICS_AND_TATWEEL, '')
}

/** Canonicalises the handful of Arabic letters people routinely type interchangeably. */
export function normalizeArabicLetters(value: string): string {
  return value
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
}

/** Full normalisation used to build the query variant that is OR'd against the raw one. */
export function normalizeArabicQuery(value: string): string {
  return normalizeArabicLetters(stripArabicDiacritics(value)).replace(/\s+/g, ' ').trim()
}

/**
 * The distinct query strings to search with: the original (sanitized)
 * query, plus its normalised form when normalisation actually changes it.
 * Never more than 2 — keeps the `.or()` filter bounded.
 */
export function searchQueryVariants(safeQuery: string): string[] {
  const normalized = normalizeArabicQuery(safeQuery)
  if (!normalized || normalized === safeQuery) return [safeQuery]
  return [safeQuery, normalized]
}
