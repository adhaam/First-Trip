'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocale } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table'
import { AlertCircle, Download, Info, Loader2, RotateCcw, Search, UserCheck, UserX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toCsv, downloadCsv } from '@/lib/csv'

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
  const router = useRouter()
  const ar = locale === 'ar'
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setLoadError('')
      setConfigured(null)
      try {
        const res = await fetch('/api/admin/newsletter')
        if (res.status === 401) { router.replace('/admin'); return }
        const data = await res.json()
        if (!res.ok) throw new Error('Newsletter unavailable')
        setSubscribers(data.subscribers || [])
        setConfigured(data.configured !== false)
      } catch {
        setLoadError(ar ? 'النشرة البريدية غير متاحة مؤقتاً.' : 'Newsletter management is temporarily unavailable.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [locale, router, reloadKey, ar])

  const filtered = useMemo(() => {
    if (!search.trim()) return subscribers
    const q = search.toLowerCase()
    return subscribers.filter(s => s.email.toLowerCase().includes(q))
  }, [subscribers, search])

  const toggleSubscribed = async (sub: Subscriber) => {
    const nextUnsubscribed = !sub.unsubscribed
    setTogglingId(sub.id)
    // Optimistic update — the badge/action flips immediately, reverted on failure.
    setSubscribers((prev) => prev.map((s) => (s.id === sub.id ? { ...s, unsubscribed: nextUnsubscribed } : s)))
    try {
      const res = await fetch(`/api/admin/newsletter/${sub.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unsubscribed: nextUnsubscribed }),
      })
      if (res.status === 401) { router.replace('/admin'); return }
      if (!res.ok) throw new Error('failed')
    } catch {
      setSubscribers((prev) => prev.map((s) => (s.id === sub.id ? { ...s, unsubscribed: sub.unsubscribed } : s)))
    } finally {
      setTogglingId(null)
    }
  }

  const exportCsv = () => {
    const headers = ['Email', 'Locale', 'Source', 'Status', 'Date Subscribed']
    const rows = filtered.map((s) => [
      s.email,
      s.locale,
      s.source,
      s.unsubscribed ? 'Unsubscribed' : 'Active',
      s.created_at,
    ])
    downloadCsv(`newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`, toCsv(headers, rows))
  }

  if (loading) {
    return (
      <div aria-busy="true" aria-label={ar ? 'جارٍ التحميل' : 'Loading'} className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (configured === false) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-16 text-center">
          <Info className="h-8 w-8 text-gray-400" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">
            {ar ? 'إدارة النشرة البريدية غير مفعلة بعد' : 'Newsletter management is not configured yet'}
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-gray-500">
            {ar
              ? 'لن تظهر بيانات اشتراكات هنا حتى يتم إعداد جدول النشرة البريدية في مشروع Supabase الحالي.'
              : 'Subscriber data will appear here after the newsletter table is configured in the existing Supabase project.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  if (loadError) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center px-6 py-16 text-center">
          <AlertCircle className="h-8 w-8 text-amber-600" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">{loadError}</h2>
          <p className="mt-2 text-sm text-gray-500">
            {ar ? 'حاول مرة أخرى. لم يتم تغيير أي بيانات.' : 'Try again. No data was changed.'}
          </p>
          <Button type="button" variant="outline" className="mt-5" onClick={() => setReloadKey((key) => key + 1)}>
            <RotateCcw className="me-2 h-4 w-4" />
            {ar ? 'إعادة المحاولة' : 'Retry'}
          </Button>
        </CardContent>
      </Card>
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
        <div className="flex items-center gap-2">
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
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="shrink-0 gap-1.5">
            <Download className="h-4 w-4" />
            {ar ? 'تصدير CSV' : 'Export CSV'}
          </Button>
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
                <TableHead>{ar ? 'إجراء' : 'Action'}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-400">
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
                    <TableCell>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => toggleSubscribed(sub)}
                        disabled={togglingId === sub.id}
                        className="gap-1.5"
                      >
                        {togglingId === sub.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : sub.unsubscribed ? (
                          <UserCheck className="h-3.5 w-3.5" />
                        ) : (
                          <UserX className="h-3.5 w-3.5" />
                        )}
                        {sub.unsubscribed
                          ? (ar ? 'إعادة الاشتراك' : 'Resubscribe')
                          : (ar ? 'إلغاء الاشتراك' : 'Unsubscribe')}
                      </Button>
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
