'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'

type EditionRequestRow = {
  id: string
  edition_slug: string
  edition_title_snapshot: string
  intent: 'JOIN' | 'ASK' | 'NOTIFY'
  customer_name: string
  phone: string
  email: string | null
  travelers: number | null
  requested_start_date: string | null
  message: string | null
  status: 'new' | 'contacted' | 'confirmed' | 'closed'
  created_at: string
}

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string) => {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [locale])
}

const STATUS_CLASS: Record<EditionRequestRow['status'], string> = {
  new: 'bg-purple-100 text-purple-700',
  contacted: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-green-100 text-green-700',
  closed: 'bg-gray-200 text-gray-700',
}

/** Read-only Edition requests list — writes (status changes) are a follow-up, not built here yet. */
export function EditionRequestsPanel() {
  const ar = useLocale() === 'ar'
  const api = useAdminFetch()
  const [requests, setRequests] = useState<EditionRequestRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

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
              <TableHead>Edition</TableHead>
              <TableHead>Intent</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Travelers</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.edition_title_snapshot}</TableCell>
                <TableCell>{r.intent}</TableCell>
                <TableCell>{r.customer_name}</TableCell>
                <TableCell dir="ltr">{r.phone}</TableCell>
                <TableCell>{r.travelers ?? '—'}</TableCell>
                <TableCell>
                  <Badge className={STATUS_CLASS[r.status]}>{r.status}</Badge>
                </TableCell>
                <TableCell>{new Date(r.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {ar ? 'لا توجد طلبات إصدارات بعد' : 'No Edition requests yet'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
