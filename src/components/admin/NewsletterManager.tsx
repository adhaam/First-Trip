'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Subscriber {
  id: string
  email: string
  locale: string
  source: string
  unsubscribed: boolean
  created_at: string
}

export function NewsletterManager() {
  const locale = useLocale()
  const ar = locale === 'ar'
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError('')
      try {
        const res = await fetch('/api/admin/newsletter')
        if (res.status === 401) { window.location.href = `/${locale}/admin`; return }
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setSubscribers(data.subscribers || [])
      } catch {
        setLoadError(ar ? 'تعذر تحميل المشتركين' : 'Failed to load subscribers')
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers
    const q = search.toLowerCase()
    return subscribers.filter(s => s.email.toLowerCase().includes(q))
  }, [subscribers, search])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="text-center py-20 text-red-500">{loadError}</div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with count and search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {ar ? 'المشتركين في النشرة البريدية' : 'Newsletter Subscribers'}
          <span className="ml-2 text-sm font-normal text-gray-500">
            ({subscribers.length})
          </span>
        </h2>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder={ar ? 'بحث بالإيميل...' : 'Search by email...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{ar ? 'الإيميل' : 'Email'}</TableHead>
                <TableHead>{ar ? 'اللغة' : 'Locale'}</TableHead>
                <TableHead>{ar ? 'المصدر' : 'Source'}</TableHead>
                <TableHead>{ar ? 'تاريخ الاشتراك' : 'Date Subscribed'}</TableHead>
                <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-400">
                    {search
                      ? (ar ? 'لا توجد نتائج' : 'No results found')
                      : (ar ? 'لا يوجد مشتركين بعد' : 'No subscribers yet')}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium" dir="ltr">{sub.email}</TableCell>
                    <TableCell>{sub.locale === 'ar' ? (ar ? 'عربي' : 'Arabic') : (ar ? 'إنجليزي' : 'English')}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{sub.source}</TableCell>
                    <TableCell className="text-sm">
                      {new Date(sub.created_at).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <span className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                        sub.unsubscribed
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      )}>
                        {sub.unsubscribed
                          ? (ar ? 'ألغى الاشتراك' : 'Unsubscribed')
                          : (ar ? 'مشترك' : 'Active')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
