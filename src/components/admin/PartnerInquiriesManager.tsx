'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2 } from 'lucide-react'
import type { PartnerInquiry, PartnerInquiryStatus } from '@/lib/types'

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

const STATUS_LABEL: Record<PartnerInquiryStatus, { ar: string; en: string; cls: string }> = {
  new: { ar: 'جديد', en: 'New', cls: 'bg-purple-100 text-purple-700' },
  contacted: { ar: 'تم التواصل', en: 'Contacted', cls: 'bg-blue-100 text-blue-700' },
  in_discussion: { ar: 'قيد النقاش', en: 'In Discussion', cls: 'bg-amber-100 text-amber-700' },
  closed: { ar: 'مغلق', en: 'Closed', cls: 'bg-gray-200 text-gray-700' },
}

export function PartnerInquiriesManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const api = useAdminFetch()
  const [inquiries, setInquiries] = useState<PartnerInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await api('/api/admin/partner-inquiries')
      setInquiries(data.inquiries || [])
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

  const updateStatus = async (id: string, status: PartnerInquiryStatus) => {
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    await api(`/api/admin/partner-inquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
                <TableHead>{ar ? 'اسم النشاط' : 'Business'}</TableHead>
                <TableHead>{ar ? 'واتساب/هاتف' : 'Phone'}</TableHead>
                <TableHead>{ar ? 'البريد الإلكتروني' : 'Email'}</TableHead>
                <TableHead>{ar ? 'نوع الشراكة' : 'Type'}</TableHead>
                <TableHead>{ar ? 'الرسالة' : 'Message'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
                <TableHead>{ar ? 'تاريخ الطلب' : 'Submitted'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={8} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && loadError && <TableRow><TableCell colSpan={8} className="text-center text-red-500 py-8">{loadError}</TableCell></TableRow>}
              {!loading && !loadError && inquiries.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات بعد' : 'No inquiries yet'}</TableCell></TableRow>
              )}
              {!loading && inquiries.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell className="text-gray-600">{i.business_name || '—'}</TableCell>
                  <TableCell dir="ltr">
                    <a href={`https://wa.me/${i.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-weemap-orange hover:underline">
                      {i.phone}
                    </a>
                  </TableCell>
                  <TableCell className="text-gray-500">{i.email || '—'}</TableCell>
                  <TableCell className="text-gray-600">{i.partnership_type || '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-gray-500">{i.message || '—'}</TableCell>
                  <TableCell>
                    <Select value={i.status} onValueChange={(v) => v && updateStatus(i.id, v as PartnerInquiryStatus)}>
                      <SelectTrigger className="w-40">
                        <SelectValue>
                          <Badge className={STATUS_LABEL[i.status].cls} variant="default">{ar ? STATUS_LABEL[i.status].ar : STATUS_LABEL[i.status].en}</Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as PartnerInquiryStatus[]).map((s) => (
                          <SelectItem key={s} value={s}>{ar ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-gray-400 text-xs">{new Date(i.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
