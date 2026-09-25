import { NextRequest, NextResponse } from 'next/server'
import { runSearch, sanitizeSearchFilter } from '@/lib/discovery/search'
import type { SearchResponse, SearchResult, SearchResultType } from '@/lib/discovery/search'

// Re-exported so existing consumers (GlobalSearch, tests) that import these
// types from this route module keep working — the actual query logic lives
// in src/lib/discovery/search.ts, shared with the /[locale]/search results page.
export type { SearchResponse, SearchResult, SearchResultType }
export { sanitizeSearchFilter }

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get('q') || ''
  const response = await runSearch(q)
  return NextResponse.json(response)
}
