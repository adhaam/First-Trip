'use client'

// Owner/admin audit trail — GET /api/admin/audit?table=&row_id=&actor=&page=
// (docs/m3/OPS_API_CONTRACT.md). Read-only: this screen only ever fetches.

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'

const KNOWN_TABLES = [
  'staff_users', 'bookings', 'trip_bookings', 'experience_bookings', 'commerce_orders',
  'commerce_rentals', 'payment_records', 'customers', 'trip_requests', 'transport_services',
  'transport_weekly_rules', 'transport_exceptions', 'transport_stay_patterns',
  'accommodations', 'sinai_trips', 'trip_packages', 'experiences', 'commerce_products',
]

const PAGE_SIZE = 25

interface AuditEntry {
  id: string
  occurred_at: string
  actor: string | null
  actor_name: string | null
  table_name: string
  row_id: string
  action: string
  changes: Record<string, unknown> | null
}

function DiffValue({ value }: { value: unknown }) {
  if (Array.isArray(value) && value.length === 2) {
    return (
      <span className="tabular-nums">
        <span className="text-gray-400 line-through">{formatScalar(value[0])}</span>
        {' → '}
        <span className="text-gray-900">{formatScalar(value[1])}</span>
      </span>
    )
  }
  return <span className="text-gray-900">{formatScalar(value)}</span>
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ChangesCell({ changes }: { changes: Record<string, unknown> | null }) {
  if (!changes || Object.keys(changes).length === 0) return <span className="text-gray-400">—</span>
  return (
    <div className="space-y-0.5">
      {Object.entries(changes).map(([key, value]) => (
        <div key={key} className="text-xs">
          <span className="font-medium text-gray-600">{key}: </span>
          <DiffValue value={value} />
        </div>
      ))}
    </div>
  )
}

export function AuditLogViewer() {
  const t = useTranslations('opsConfig.audit')
  const tCommon = useTranslations('opsConfig.common')

  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [tableFilter, setTableFilter] = useState('all')
  const [actorFilter, setActorFilter] = useState('')
  const [rowIdFilter, setRowIdFilter] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ table: 'all', actor: '', rowId: '' })

  const load = useCallback(async (targetPage: number, filters: typeof appliedFilters) => {
    setLoading(true)
    setLoadError('')
    try {
      const params = new URLSearchParams({ page: String(targetPage) })
      if (filters.table !== 'all') params.set('table', filters.table)
      if (filters.actor.trim()) params.set('actor', filters.actor.trim())
      if (filters.rowId.trim()) params.set('row_id', filters.rowId.trim())
      const res = await fetch(`/api/admin/audit?${params.toString()}`)
      if (res.status === 401) { window.location.href = '/admin'; return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEntries(data.entries || [])
      setTotal(data.total || 0)
      setPage(data.page || targetPage)
    } catch {
      setLoadError(tCommon('loadError'))
    } finally {
      setLoading(false)
    }
  }, [tCommon])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load(1, appliedFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const applyFilters = () => {
    const filters = { table: tableFilter, actor: actorFilter, rowId: rowIdFilter }
    setAppliedFilters(filters)
    load(1, filters)
  }

  const clearFilters = () => {
    setTableFilter('all'); setActorFilter(''); setRowIdFilter('')
    setAppliedFilters({ table: 'all', actor: '', rowId: '' })
    load(1, { table: 'all', actor: '', rowId: '' })
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const tableLabel = (name: string) => (
    (KNOWN_TABLES as readonly string[]).includes(name) ? t(`tables.${name}`) : name
  )

  const actionLabel = (action: string) => (
    ['INSERT', 'UPDATE', 'DELETE'].includes(action) ? t(`actions.${action}`) : action
  )

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{t('title')}</h2>
        <p className="text-sm text-gray-500">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="audit-table-filter" className="text-xs text-gray-500">{t('filters.table')}</Label>
          <Select value={tableFilter} onValueChange={(v) => v && setTableFilter(v)}>
            <SelectTrigger id="audit-table-filter" className="mt-1 w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('filters.allTables')}</SelectItem>
              {KNOWN_TABLES.map((name) => (
                <SelectItem key={name} value={name}>{tableLabel(name)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="audit-actor-filter" className="text-xs text-gray-500">{t('filters.actor')}</Label>
          <Input
            id="audit-actor-filter" className="mt-1 w-[160px]" dir="ltr"
            value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="audit-row-filter" className="text-xs text-gray-500">{t('filters.rowId')}</Label>
          <Input
            id="audit-row-filter" className="mt-1 w-[190px]" dir="ltr"
            value={rowIdFilter} onChange={(e) => setRowIdFilter(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={applyFilters}>{t('filters.apply')}</Button>
        <Button size="sm" variant="ghost" className="gap-1.5 text-gray-500" onClick={clearFilters}>
          <RotateCcw className="h-3.5 w-3.5" />
          {t('filters.clear')}
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('table.time')}</TableHead>
                <TableHead scope="col">{t('table.actor')}</TableHead>
                <TableHead scope="col">{t('table.tableName')}</TableHead>
                <TableHead scope="col">{t('table.action')}</TableHead>
                <TableHead scope="col">{t('table.changes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-400">
                  <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />{tCommon('loading')}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-red-500">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && entries.length === 0 && (
                <TableRow><TableCell colSpan={5} className="py-8 text-center text-gray-400">{t('empty')}</TableCell></TableRow>
              )}
              {!loading && !loadError && entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-gray-500">
                    {new Date(entry.occurred_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm">{entry.actor_name || entry.actor || '—'}</TableCell>
                  <TableCell className="text-sm">{tableLabel(entry.table_name)}</TableCell>
                  <TableCell className="text-sm">{actionLabel(entry.action)}</TableCell>
                  <TableCell><ChangesCell changes={entry.changes} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading && !loadError && entries.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>{t('pageOf', { page, total: totalPages })}</span>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm" className="gap-1"
              disabled={page <= 1}
              onClick={() => load(page - 1, appliedFilters)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {t('previous')}
            </Button>
            <Button
              variant="outline" size="sm" className="gap-1"
              disabled={page >= totalPages}
              onClick={() => load(page + 1, appliedFilters)}
            >
              {t('next')}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
