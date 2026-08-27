'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import type { ExperienceBooking, ExperienceRequestStatus } from '@/lib/types'

function useAdminFetch() {
  const locale = useLocale()
  return useCallback(async (url: string, init?: RequestInit) => {
    const res = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
    if (res.status === 401) { window.location.href = locale === 'ar' ? '/admin' : '/en/admin'; throw new Error('unauthorized') }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  }, [locale])
}

const STATUS_LABEL: Record<ExperienceRequestStatus, { ar: string; en: string; cls: string }> = {
  new: { ar: 'جديد', en: 'New', cls: 'bg-purple-100 text-purple-700' },
  contacted: { ar: 'تم التواصل', en: 'Contacted', cls: 'bg-blue-100 text-blue-700' },
  planning: { ar: 'قيد التجهيز', en: 'Planning', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { ar: 'مؤكد', en: 'Confirmed', cls: 'bg-green-100 text-green-700' },
  completed: { ar: 'مكتمل', en: 'Completed', cls: 'bg-gray-200 text-gray-700' },
  cancelled: { ar: 'ملغي', en: 'Cancelled', cls: 'bg-red-100 text-red-700' },
}

export function ExperienceRequestsManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [requests, setRequests] = useState<ExperienceBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await api('/api/admin/experience-bookings')
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

  const updateStatus = async (id: string, status: ExperienceRequestStatus) => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    await api(`/api/admin/experience-bookings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'التجربة' : 'Experience'}</TableHead>
                <TableHead>{ar ? 'الهاتف' : 'Phone'}</TableHead>
                <TableHead>{ar ? 'المهتمين بـ' : 'Interests'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{ar ? 'تاريخ الطلب' : 'Submitted'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && loadError && <TableRow><TableCell colSpan={6} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>}
              {!loading && !loadError && requests.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات بعد' : 'No requests yet'}</TableCell></TableRow>
              )}
              {!loading && requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.full_name}</TableCell>
                  <TableCell className="text-gray-600">
                    {r.experiences ? (ar ? r.experiences.title_ar : r.experiences.title_en) : (
                      <Badge variant="outline" className="text-weemap-orange border-weemap-orange">{ar ? 'ابنِ تجربتك' : 'Build Your Signature'}</Badge>
                    )}
                  </TableCell>
                  <TableCell dir="ltr" className="text-gray-500">{r.phone}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-gray-500">{r.interests || '—'}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => v && updateStatus(r.id, v as ExperienceRequestStatus)}>
                      <SelectTrigger className="w-36">
                        <SelectValue>
                          <Badge className={STATUS_LABEL[r.status].cls} variant="default">{ar ? STATUS_LABEL[r.status].ar : STATUS_LABEL[r.status].en}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as ExperienceRequestStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{ar ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
