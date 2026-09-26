'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { editionRequestIntentLabel } from '@/lib/editions-labels'
import type { EditionRequestIntent } from '@/lib/editions'

type RequestStatus = 'new' | 'contacted' | 'confirmed' | 'closed'

type EditionRequestRow = {
  id: string
  edition_slug: string
  edition_title_snapshot: string
  intent: EditionRequestIntent
  customer_name: string
  phone: string
  email: string | null
  travelers: number | null
  requested_start_date: string | null
  message: string | null
  status: RequestStatus
  created_at: string
}

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...init })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [locale])
}

const STATUS_CLASS: Record<RequestStatus, string> = {
  new: 'bg-purple-100 text-purple-700',
  contacted: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-700',
}

const STATUS_LABEL: Record<RequestStatus, { en: string; ar: string }> = {
  new: { en: 'New', ar: 'جديد' },
  contacted: { en: 'Contacted', ar: 'تم التواصل' },
  confirmed: { en: 'Confirmed', ar: 'مؤكد' },
  closed: { en: 'Closed', ar: 'مغلق' },
}

const NEXT_ACTION_HINT: Record<RequestStatus, { en: string; ar: string } | null> = {
  new: { en: 'Contact customer', ar: 'تواصل مع العميل' },
  contacted: { en: 'Confirm or close', ar: 'أكّد أو أغلق' },
  confirmed: null,
  closed: null,
}

const STATUS_ORDER: RequestStatus[] = ['new', 'contacted', 'confirmed', 'closed']

export function EditionRequestsPanel() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [requests, setRequests] = useState<EditionRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await api('/api/admin/edition-requests')
      setRequests(data.requests || [])
    } catch {
      setLoadError(ar ? 'تعذر تحميل البيانات' : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [api, ar])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const changeStatus = useCallback(async (id: string, status: RequestStatus) => {
    setSavingId(id)
    try {
      await api(`/api/admin/edition-requests/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    } catch {
      // Reload to recover true state on failure.
      load()
    } finally {
      setSavingId(null)
    }
  }, [api, load])

  if (loading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }
  if (loadError) return <p className="text-sm text-destructive">{loadError}</p>

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{ar ? 'التجربة' : 'Experience'}</TableHead>
              <TableHead>{ar ? 'النوع' : 'Intent'}</TableHead>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{ar ? 'الهاتف' : 'Phone'}</TableHead>
              <TableHead>{ar ? 'المسافرون' : 'Travelers'}</TableHead>
              <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              <TableHead>{ar ? 'تاريخ الاستلام' : 'Received'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => {
              const hint = NEXT_ACTION_HINT[r.status]
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.edition_title_snapshot}</TableCell>
                  <TableCell>{editionRequestIntentLabel(r.intent, locale)}</TableCell>
                  <TableCell>{r.customer_name}</TableCell>
                  <TableCell dir="ltr">{r.phone}</TableCell>
                  <TableCell>{r.travelers ?? '—'}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Select
                        value={r.status}
                        onValueChange={(v) => changeStatus(r.id, v as RequestStatus)}
                        disabled={savingId === r.id}
                      >
                        <SelectTrigger className="h-8 w-[150px]">
                          <SelectValue>
                            <Badge className={STATUS_CLASS[r.status]}>
                              {ar ? STATUS_LABEL[r.status].ar : STATUS_LABEL[r.status].en}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_ORDER.map((s) => (
                            <SelectItem key={s} value={s}>{ar ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {hint && (
                        <span className="text-xs text-muted-foreground">{ar ? hint.ar : hint.en}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              )
            })}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {ar ? 'لا توجد طلبات تجارب بعد' : 'No experience requests yet'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
