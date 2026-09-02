'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Search, X, Loader2, MapPin, Mountain, ShoppingBag, Package } from 'lucide-react'
import { SafeImage as Image } from '@/components/SafeImage'
import { cn } from '@/lib/utils'
import type { SearchResult, SearchResultType } from '@/app/api/search/route'
import { trackConversion } from '@/lib/conversion'

const TYPE_ORDER: SearchResultType[] = ['accommodation', 'trip', 'merch', 'rental']

/** Search result kinds mapped onto the conversion layer's content types. */
const SEARCH_CONTENT_TYPE = {
  accommodation: 'accommodation',
  trip: 'trip',
  merch: 'product',
  rental: 'rental',
} as const

function groupResults(results: SearchResult[]): Map<SearchResultType, SearchResult[]> {
  const map = new Map<SearchResultType, SearchResult[]>()
  for (const t of TYPE_ORDER) map.set(t, [])
  for (const r of results) map.get(r.type)?.push(r)
  return map
}

function ResultIcon({ type }: { type: SearchResultType }) {
  if (type === 'accommodation') return <MapPin className="h-3.5 w-3.5 shrink-0 text-sea-500" aria-hidden />
  if (type === 'trip') return <Mountain className="h-3.5 w-3.5 shrink-0 text-sun-700" aria-hidden />
  if (type === 'merch') return <ShoppingBag className="h-3.5 w-3.5 shrink-0 text-brand-blue" aria-hidden />
  return <Package className="h-3.5 w-3.5 shrink-0 text-brand-orange" aria-hidden />
}

export function GlobalSearch() {
  const t = useTranslations('search')
  const locale = useLocale()
  const ar = locale === 'ar'
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openSearch = () => {
    setOpen(true)
    setQuery('')
    setResults([])
    setError(false)
    setActiveIdx(-1)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const closeSearch = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError(false)
    // Returning focus to the button that opened the dialog is what stops a
    // keyboard user being dumped back at the top of the document.
    requestAnimationFrame(() => triggerRef.current?.focus())
  }, [])

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (open) closeSearch(); else openSearch()
      }
      if (e.key === 'Escape' && open) closeSearch()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, closeSearch])

  // Focus trap + body scroll lock. Without the trap, Tab walks straight out of
  // an `aria-modal` dialog and into the page behind it, which is exactly the
  // situation the attribute promises cannot happen.
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return

      const focusable = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query || query.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale results when query is too short
      setResults([])
      setLoading(false)
      setError(false)
      setActiveIdx(-1)
      return
    }
    setLoading(true)
    setError(false)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setResults(data.results || [])
        setActiveIdx(-1)
      } catch {
        setError(true)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const flatResults = results // for keyboard nav
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      const r = flatResults[activeIdx]
      if (r) navigate(r)
    }
  }

  const navigate = (r: SearchResult) => {
    // Fired on selection, not on typing: a debounced query is not intent, and
    // firing per keystroke would flood the pixel with noise.
    trackConversion(
      'search_result_selected',
      { content_type: SEARCH_CONTENT_TYPE[r.type], item_id: r.id, source: 'global_search' },
      { once: false },
    )
    closeSearch()
    router.push(r.url as Parameters<typeof router.push>[0])
  }

  const grouped = groupResults(results)

  const groupLabel = (type: SearchResultType) => {
    if (type === 'accommodation') return ar ? t('groupAccommodations') : t('groupAccommodations')
    if (type === 'trip') return ar ? t('groupTrips') : t('groupTrips')
    if (type === 'merch') return ar ? t('groupMerch') : t('groupMerch')
    return ar ? t('groupRentals') : t('groupRentals')
  }

  // Results flat list for keyboard indexing
  let globalIdx = 0
  const resultNodes: { result: SearchResult; idx: number }[] = []
  for (const type of TYPE_ORDER) {
    for (const r of (grouped.get(type) || [])) {
      resultNodes.push({ result: r, idx: globalIdx++ })
    }
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={openSearch}
        aria-label={t('label')}
        aria-haspopup="dialog"
        className={cn(
          'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
          'text-white hover:bg-white/10',
        )}
      >
        <Search className="h-5 w-5" />
      </button>
    )
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={closeSearch}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('label')}
        className="fixed inset-x-4 top-[5vh] z-50 mx-auto max-w-xl overflow-hidden rounded-2xl border border-sand-300 bg-sand-50 shadow-2xl"
      >
        {/* Input row */}
        <div className="flex items-center gap-2 border-b border-sand-200 px-4 py-3">
          {loading
            ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sea-500" aria-hidden />
            : <Search className="h-5 w-5 shrink-0 text-ink-subtle" aria-hidden />
          }
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={resultNodes.length > 0}
            aria-controls="global-search-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeIdx >= 0 ? `global-search-option-${activeIdx}` : undefined}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('placeholder')}
            aria-label={t('label')}
            className="min-w-0 flex-1 bg-transparent text-sm text-sea-900 placeholder:text-ink-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={closeSearch}
            aria-label={t('close')}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle hover:bg-sand-200 hover:text-sea-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Screen readers get told how many results the query produced; sighted
            users can already see the list change. */}
        <p aria-live="polite" className="sr-only">
          {query.length < 2 ? '' : loading ? t('searching') : t('resultsCount', { count: resultNodes.length })}
        </p>

        {/* Results */}
        <div
          id="global-search-listbox"
          className="max-h-[60vh] overflow-y-auto"
          role="listbox"
          aria-label={t('label')}
        >
          {!query || query.length < 2 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-subtle">{t('prompt')}</p>
          ) : error ? (
            <p className="px-4 py-8 text-center text-sm text-red-500">{t('error')}</p>
          ) : !loading && results.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-ink-muted">{t('empty', { query })}</p>
              <p className="mt-1 text-xs text-ink-subtle">{t('emptyHint')}</p>
            </div>
          ) : (
            <div className="py-2">
              {TYPE_ORDER.map((type) => {
                const group = grouped.get(type) || []
                if (group.length === 0) return null
                return (
                  <div key={type}>
                    <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-ink-subtle">
                      {groupLabel(type)}
                    </p>
                    {group.map((r) => {
                      const node = resultNodes.find((n) => n.result === r)!
                      const isActive = node.idx === activeIdx
                      const title = ar ? r.title_ar || r.title_en : r.title_en || r.title_ar
                      const desc = ar ? r.description_ar || r.description_en : r.description_en || r.description_ar
                      const cat = ar ? r.category_ar : r.category_en
                      return (
                        <button
                          key={r.id}
                          id={`global-search-option-${node.idx}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onClick={() => navigate(r)}
                          onMouseEnter={() => setActiveIdx(node.idx)}
                          className={cn(
                            'flex w-full items-center gap-3 px-4 py-2.5 text-start transition-colors',
                            isActive ? 'bg-sand-200' : 'hover:bg-sand-100',
                          )}
                        >
                          {r.image ? (
                            <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded bg-sand-200">
                              <Image src={r.image} alt="" fill sizes="56px" className="object-cover" />
                            </div>
                          ) : (
                            <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded bg-sand-200">
                              <ResultIcon type={r.type} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-sea-900">{title}</p>
                            {(cat || desc) && (
                              <p className="mt-0.5 truncate text-[11px] text-ink-subtle">
                                {cat && <span>{cat}{desc ? ' · ' : ''}</span>}
                                {desc && <span>{desc}</span>}
                              </p>
                            )}
                          </div>
                          {r.price != null && r.price > 0 && (
                            <p className="shrink-0 text-xs font-semibold text-sea-700">
                              {t('from')} {r.price.toLocaleString(ar ? 'ar-EG' : 'en-US')}
                            </p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
