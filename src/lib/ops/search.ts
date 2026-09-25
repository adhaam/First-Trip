const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩'

export function normalizeOpsQuery(query: string): { text: string, digits: string | null } {
  const cleaned = query
    .replace(/[\%_*(),]/g, ' ')
    .replace(/[\u064B-\u0652\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .trim()
    .replace(/\s+/g, ' ')
  const digits = [...query].map((char) => {
    const index = ARABIC_INDIC.indexOf(char)
    return index === -1 ? char : String(index)
  }).join('').replace(/\D/g, '')
  return { text: cleaned, digits: digits.length >= 4 ? digits : null }
}
