'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Search, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Link } from '@/i18n/navigation'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { customerHref, dashboardHref, workItemHref } from '@/components/admin/ops/nav'
import { EntityTypeLabel } from '@/components/admin/ops/pills'
import type { OpsEntityType } from '@/lib/ops/types'

type SearchCustomer = { id: string; name: string; phone: string; email: string | null; last_activity_at: string | null }
type SearchCatalogue = { type: 'stay' | 'trip' | 'package' | 'signature' | 'product'; id: string; title_en: string; title_ar: string; is_active: boolean; subtitle: string | null }
type SearchItem = { entity_type: OpsEntityType; entity_id: string; reference: string; customer_name: string }
type SearchResponse = { customers: SearchCustomer[]; items: SearchItem[]; catalogue: SearchCatalogue[] }

const CATALOGUE_SECTION: Record<SearchCatalogue['type'], string> = {
  stay: 'accommodations',
  trip: 'sinai-trips',
  package: 'trip-packages',
  signature: 'signature-experiences',
  product: 'commerce',
}

export function OpsSearch() {
  const locale = useLocale()
  const t = useTranslations('ops.search')
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fetchJson = useOpsFetch()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale results as soon as the query is too short
    if (query.trim().length < 2) { setResults(null); setError(''); return }
    setLoading(true)
    setError('')
    const id = setTimeout(async () => {
      try {
        const res = await fetchJson(`/api/admin/ops/search?q=${encodeURIComponent(query.trim())}`)
        setResults(res)
      } catch (err) {
        if (err instanceof Error && err.message !== 'unauthorized') setError(t('error'))
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => clearTimeout(id)
  }, [query, fetchJson, t])

  const showPanel = open && query.trim().length >= 2

  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={t('placeholder')}
          aria-label={t('placeholder')}
          className="ps-9"
        />
      </div>

      {showPanel && (
        <div className="absolute z-40 mt-1 w-full rounded-lg border bg-white p-2 shadow-lg">
          {loading && <p className="flex items-center gap-2 p-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t('loading')}</p>}
          {error && <p className="p-2 text-sm text-red-700">{error}</p>}
          {!loading && !error && results && (
            <>
              {results.customers.length === 0 && results.items.length === 0 && results.catalogue.length === 0 && (
                <p className="p-2 text-sm text-muted-foreground">{t('noResults', { query })}</p>
              )}
              {results.customers.length > 0 && (
                <ResultGroup title={t('customers')}>
                  {results.customers.map((c) => (
                    <Link key={c.id} href={customerHref(c.id)} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="font-medium">{c.name}</span> <span className="text-muted-foreground" dir="ltr">{c.phone}</span>
                    </Link>
                  ))}
                </ResultGroup>
              )}
              {results.items.length > 0 && (
                <ResultGroup title={t('items')}>
                  {results.items.map((item) => (
                    <Link key={`${item.entity_type}:${item.entity_id}`} href={workItemHref(item.entity_type, item.entity_id)} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="font-medium" dir="ltr">{item.reference}</span>{' '}
                      <span className="text-muted-foreground"><EntityTypeLabel type={item.entity_type} /> · {item.customer_name}</span>
                    </Link>
                  ))}
                </ResultGroup>
              )}
              {results.catalogue.length > 0 && (
                <ResultGroup title={t('catalogue')}>
                  {results.catalogue.map((entry) => (
                    <Link key={`${entry.type}:${entry.id}`} href={dashboardHref(CATALOGUE_SECTION[entry.type])} className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                      <span className="font-medium">{locale === 'ar' ? entry.title_ar : entry.title_en}</span>
                      {entry.subtitle && <span className="text-muted-foreground"> · {entry.subtitle}</span>}
                    </Link>
                  ))}
                </ResultGroup>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  )
}
