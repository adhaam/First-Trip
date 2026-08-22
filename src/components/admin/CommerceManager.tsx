'use client'

import { useEffect, useState, useCallback } from 'react'
import { useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Plus, MessageCircle, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProductEditor } from './ProductEditor'

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

// ─────────────────────────────────────────────────────────────────────────
// Categories
// ─────────────────────────────────────────────────────────────────────────
interface Category {
  id: string; slug: string; name_ar: string; name_en: string
  applies_to: 'sale' | 'rental' | 'both'; is_active: boolean
}

function CategoriesTab({ items, loading, onReload }: { items: Category[]; loading: boolean; onReload: () => void }) {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [form, setForm] = useState({ slug: '', name_ar: '', name_en: '', applies_to: 'both' as const })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const create = async () => {
    setFormError('')
    if (!form.slug || !form.name_ar || !form.name_en) {
      setFormError(ar ? 'يرجى ملء جميع الحقول المطلوبة (المعرف، الاسم بالعربي، الاسم بالإنجليزي)' : 'Please fill in all required fields (slug, Arabic name, English name)')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setFormError(ar ? 'المعرف (slug) يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطة (-) بدون مسافات' : 'Slug must contain only lowercase letters, numbers, and hyphens (-) — no spaces')
      return
    }
    setSaving(true)
    try {
      await api('/api/admin/commerce/categories', { method: 'POST', body: JSON.stringify(form) })
      setForm({ slug: '', name_ar: '', name_en: '', applies_to: 'both' })
      setFormError('')
      onReload()
    } catch (e) { setFormError((e as Error).message) } finally { setSaving(false) }
  }

  const toggleActive = async (c: Category) => {
    await api(`/api/admin/commerce/categories/${c.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !c.is_active }) })
    onReload()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-5">
          <Input placeholder={ar ? 'المعرف (slug) — أحرف صغيرة وأرقام وشرطة فقط' : 'Slug — lowercase, numbers, hyphens only'} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
          <Input placeholder={ar ? 'الاسم بالعربي *' : 'Name (Arabic) *'} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
          <Input placeholder={ar ? 'الاسم بالإنجليزي *' : 'Name (English) *'} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
          <Select value={form.applies_to} onValueChange={(v) => v && setForm((f) => ({ ...f, applies_to: v as typeof f.applies_to }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="both">{ar ? 'بيع وإيجار' : 'Sale & rental'}</SelectItem>
              <SelectItem value="sale">{ar ? 'بيع فقط' : 'Sale only'}</SelectItem>
              <SelectItem value="rental">{ar ? 'إيجار فقط' : 'Rental only'}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={create} disabled={saving}><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة تصنيف' : 'Add category'}</Button>
          {formError && <p className="sm:col-span-5 text-xs text-red-600 font-medium">{formError}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{ar ? 'ينطبق على' : 'Applies to'}</TableHead>
              <TableHead>{ar ? 'مفعّل' : 'Active'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{ar ? c.name_ar : c.name_en}</TableCell>
                  <TableCell dir="ltr">{c.slug}</TableCell>
                  <TableCell>{c.applies_to}</TableCell>
                  <TableCell><Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} /></TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-gray-400 py-8">{ar ? 'لا توجد تصنيفات بعد' : 'No categories yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Products
// ─────────────────────────────────────────────────────────────────────────
interface Product {
  id: string; slug: string; name_ar: string; name_en: string
  product_type: 'sale' | 'rental'; base_price: number; is_active: boolean; is_featured: boolean
  commerce_categories: { name_ar: string; name_en: string } | null
}

function ProductsTab({ categories, collections }: { categories: Category[]; collections: { id: string; name_ar: string; name_en: string }[] }) {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api('/api/admin/commerce/products')).products || []) } finally { setLoading(false) }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  if (editingId || creatingNew) {
    return (
      <ProductEditor
        api={api}
        productId={editingId}
        categories={categories}
        collections={collections}
        onClose={() => { setEditingId(null); setCreatingNew(false) }}
        onSaved={load}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreatingNew(true)} className="bg-brand-blue hover:bg-brand-blue-dark text-white"><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة منتج' : 'Add product'}</Button>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{ar ? 'النوع' : 'Type'}</TableHead>
              <TableHead>{ar ? 'التصنيف' : 'Category'}</TableHead>
              <TableHead>{ar ? 'السعر' : 'Price'}</TableHead>
              <TableHead>{ar ? 'مفعّل' : 'Active'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((p) => (
                <TableRow key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setEditingId(p.id)}>
                  <TableCell className="font-medium">{ar ? p.name_ar : p.name_en} {p.is_featured && <span className="ms-1 text-xs text-sun-600">★</span>}</TableCell>
                  <TableCell>{p.product_type === 'sale' ? (ar ? 'بيع' : 'Sale') : (ar ? 'إيجار' : 'Rental')}</TableCell>
                  <TableCell>{p.commerce_categories ? (ar ? p.commerce_categories.name_ar : p.commerce_categories.name_en) : '—'}</TableCell>
                  <TableCell>{p.base_price}</TableCell>
                  <TableCell>
                    <Badge className={p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {p.is_active ? (ar ? 'نشط' : 'Active') : (ar ? 'غير نشط' : 'Inactive')}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{ar ? 'لا توجد منتجات بعد' : 'No products yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Orders
// ─────────────────────────────────────────────────────────────────────────
type OrderStatus = 'new' | 'contacted' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'completed' | 'cancelled'
interface Order {
  id: string; order_number: string; order_type: string; status: OrderStatus
  total_price: number; created_at: string; fulfillment_method: string
  customers: { name: string; phone: string } | null
}
interface OrderItem {
  id: string; item_type: 'sale' | 'rental'; name_snapshot_ar: string; name_snapshot_en: string
  quantity: number; unit_price: number; line_total: number
  rental_start_date: string | null; rental_end_date: string | null
}
interface OrderDetail extends Order {
  customers: { id: string; name: string; phone: string; whatsapp_phone: string | null; normalized_phone: string | null } | null
  commerce_order_items: OrderItem[]
  delivery_address: string; notes: string; internal_notes: string; subtotal: number; delivery_fee: number
  delivery_zones: { name_ar: string; name_en: string } | null
}

const ORDER_STATUSES: OrderStatus[] = ['new', 'contacted', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']
const ORDER_STATUS_LABELS_AR: Record<OrderStatus, string> = {
  new: 'جديد', contacted: 'تم التواصل', confirmed: 'مؤكد', preparing: 'قيد التجهيز', ready: 'جاهز', out_for_delivery: 'في الطريق', completed: 'مكتمل', cancelled: 'ملغي',
}
const ORDER_STATUS_LABELS_EN: Record<OrderStatus, string> = {
  new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', preparing: 'Preparing', ready: 'Ready', out_for_delivery: 'Out for delivery', completed: 'Completed', cancelled: 'Cancelled',
}

function OrdersTab() {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [detail, setDetail] = useState<OrderDetail | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api('/api/admin/commerce/orders')).orders || []) } finally { setLoading(false) }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const updateStatus = async (id: string, status: OrderStatus) => {
    // Cancelling restocks any decremented sale inventory — guard against an
    // accidental click on a destructive, hard-to-reverse action.
    if (status === 'cancelled' && !window.confirm(ar ? 'إلغاء الطلب هيرجع أي مخزون تم حجزه. تأكيد؟' : 'Cancelling this order will restock any reserved inventory. Confirm?')) {
      return
    }
    setItems((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)))
    if (detail?.id === id) setDetail((d) => (d ? { ...d, status } : d))
    await api(`/api/admin/commerce/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
  }

  const openDetail = async (id: string) => {
    const data = await api(`/api/admin/commerce/orders/${id}`)
    setDetail(data.order as OrderDetail)
  }

  // Prefer the normalized (E.164) phone for wa.me links — the raw `phone`
  // field may still be in local format (e.g. "010xxxxxxxx"), which produces
  // a broken WhatsApp link missing the country code.
  const number = (detail?.customers?.whatsapp_phone || detail?.customers?.normalized_phone || detail?.customers?.phone || '').replace(/[^0-9]/g, '')

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'رقم الطلب' : 'Order #'}</TableHead>
              <TableHead>{ar ? 'العميل' : 'Customer'}</TableHead>
              <TableHead>{ar ? 'النوع' : 'Type'}</TableHead>
              <TableHead>{ar ? 'الإجمالي' : 'Total'}</TableHead>
              <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((o) => (
                <TableRow key={o.id} className="cursor-pointer hover:bg-gray-50" onClick={() => openDetail(o.id)}>
                  <TableCell className="font-medium" dir="ltr">{o.order_number}</TableCell>
                  <TableCell>{o.customers?.name || '—'} <span dir="ltr" className="text-gray-400">{o.customers?.phone}</span></TableCell>
                  <TableCell>{o.order_type}</TableCell>
                  <TableCell>{o.total_price} {ar ? 'ج.م' : 'EGP'}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select value={o.status} onValueChange={(v) => v && updateStatus(o.id, v as OrderStatus)}>
                      <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ORDER_STATUSES.map((s) => <SelectItem key={s} value={s}>{ar ? ORDER_STATUS_LABELS_AR[s] : ORDER_STATUS_LABELS_EN[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات بعد' : 'No orders yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
          {detail && (
            <>
            <DialogTitle dir="ltr" className="font-bold text-gray-900">{detail.order_number}</DialogTitle>
            <div className="space-y-1 text-sm">
              <p><span className="text-gray-500">{ar ? 'العميل: ' : 'Customer: '}</span>{detail.customers?.name}</p>
              <p dir="ltr" className="text-gray-500">{detail.customers?.phone}</p>
              <p><span className="text-gray-500">{ar ? 'الاستلام: ' : 'Fulfillment: '}</span>{detail.fulfillment_method}</p>
              {detail.fulfillment_method === 'delivery' && (
                <>
                  <p><span className="text-gray-500">{ar ? 'المنطقة: ' : 'Zone: '}</span>{detail.delivery_zones ? (ar ? detail.delivery_zones.name_ar : detail.delivery_zones.name_en) : '—'}</p>
                  <p><span className="text-gray-500">{ar ? 'العنوان: ' : 'Address: '}</span>{detail.delivery_address || '—'}</p>
                </>
              )}
              {detail.notes && <p><span className="text-gray-500">{ar ? 'ملاحظات: ' : 'Notes: '}</span>{detail.notes}</p>}
            </div>
            <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
              {detail.commerce_order_items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>
                    {ar ? item.name_snapshot_ar : item.name_snapshot_en} × {item.quantity}
                    {item.rental_start_date && <span className="text-gray-400"> ({item.rental_start_date} → {item.rental_end_date})</span>}
                  </span>
                  <span className="tabular-nums">{item.line_total} {ar ? 'ج.م' : 'EGP'}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 font-bold text-gray-900">
              <span>{ar ? 'الإجمالي' : 'Total'}</span><span>{detail.total_price} {ar ? 'ج.م' : 'EGP'}</span>
            </div>
            {number && (
              <a href={`https://wa.me/${number}`} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700">
                <MessageCircle className="h-4 w-4" />{ar ? 'واتساب العميل' : 'WhatsApp customer'}
              </a>
            )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Rentals (reservations)
// ─────────────────────────────────────────────────────────────────────────
type RentalStatus = 'requested' | 'contacted' | 'confirmed' | 'active' | 'returned' | 'completed' | 'cancelled' | 'late'
interface Reservation {
  id: string; quantity: number; start_date: string; end_date: string; status: RentalStatus
  commerce_products: { name_ar: string; name_en: string } | null
  commerce_order_items: { order_id: string; commerce_orders: { order_number: string; customers: { name: string; phone: string } | null } | null } | null
}
const RENTAL_STATUSES: RentalStatus[] = ['requested', 'contacted', 'confirmed', 'active', 'returned', 'completed', 'cancelled', 'late']

const OPS_VIEWS = ['all', 'new', 'upcoming', 'active', 'due_today', 'late', 'returned', 'cancelled'] as const
type OpsView = (typeof OPS_VIEWS)[number]
const OPS_LABELS_AR: Record<OpsView, string> = { all: 'الكل', new: 'طلبات جديدة', upcoming: 'مؤكد قادم', active: 'نشط', due_today: 'مستحق اليوم', late: 'متأخر', returned: 'مُرجع', cancelled: 'ملغي' }
const OPS_LABELS_EN: Record<OpsView, string> = { all: 'All', new: 'New requests', upcoming: 'Confirmed upcoming', active: 'Active', due_today: 'Due today', late: 'Late', returned: 'Returned', cancelled: 'Cancelled' }

function RentalsTab() {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<OpsView>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api('/api/admin/commerce/rentals')).reservations || []) } finally { setLoading(false) }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const today = new Date().toISOString().slice(0, 10)
  const filtered = items.filter((r) => {
    switch (view) {
      case 'all': return true
      case 'new': return r.status === 'requested' || r.status === 'contacted'
      case 'upcoming': return r.status === 'confirmed' && r.start_date > today
      case 'active': return r.status === 'active'
      case 'due_today': return (r.status === 'active' || r.status === 'confirmed') && r.end_date === today
      case 'late': return r.status === 'late'
      case 'returned': return r.status === 'returned' || r.status === 'completed'
      case 'cancelled': return r.status === 'cancelled'
    }
  })

  const updateStatus = async (id: string, status: RentalStatus) => {
    if (status === 'cancelled' && !window.confirm(ar ? 'إلغاء الحجز هيفرج عن التوافر للتواريخ دي. تأكيد؟' : 'Cancelling this reservation releases its dates back to availability. Confirm?')) {
      return
    }
    const prevItems = items
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)))
    try {
      await api(`/api/admin/commerce/rentals/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    } catch (e) {
      setItems(prevItems)
      alert((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {OPS_VIEWS.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn('h-8 shrink-0 rounded-full border px-3 text-xs font-medium whitespace-nowrap', view === v ? 'border-brand-blue bg-brand-blue text-white' : 'border-gray-300 text-gray-500')}
          >
            {ar ? OPS_LABELS_AR[v] : OPS_LABELS_EN[v]}
          </button>
        ))}
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'المنتج' : 'Product'}</TableHead>
              <TableHead>{ar ? 'العميل' : 'Customer'}</TableHead>
              <TableHead>{ar ? 'الكمية' : 'Qty'}</TableHead>
              <TableHead>{ar ? 'من' : 'From'}</TableHead>
              <TableHead>{ar ? 'إلى' : 'To'}</TableHead>
              <TableHead>{ar ? 'الحالة' : 'Status'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.commerce_products ? (ar ? r.commerce_products.name_ar : r.commerce_products.name_en) : '—'}</TableCell>
                  <TableCell>{r.commerce_order_items?.commerce_orders?.customers?.name || '—'}</TableCell>
                  <TableCell>{r.quantity}</TableCell>
                  <TableCell>{r.start_date}</TableCell>
                  <TableCell>{r.end_date}</TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => v && updateStatus(r.id, v as RentalStatus)}>
                      <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RENTAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">{ar ? 'لا توجد طلبات إيجار في هذا العرض' : 'No reservations in this view'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Availability blocks
// ─────────────────────────────────────────────────────────────────────────
interface Block { id: string; product_id: string; variant_id: string | null; quantity: number; start_date: string; end_date: string; reason: string }

function AvailabilityBlocksTab({ rentalProducts }: { rentalProducts: Product[] }) {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ product_id: '', quantity: 1, start_date: '', end_date: '', reason: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api('/api/admin/commerce/availability-blocks')).blocks || []) } finally { setLoading(false) }
  }, [api])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const create = async () => {
    if (!form.product_id || !form.start_date || !form.end_date) return
    setSaving(true)
    try {
      await api('/api/admin/commerce/availability-blocks', { method: 'POST', body: JSON.stringify(form) })
      setForm({ product_id: '', quantity: 1, start_date: '', end_date: '', reason: '' })
      load()
    } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }
  const remove = async (id: string) => {
    setItems((prev) => prev.filter((b) => b.id !== id))
    await api(`/api/admin/commerce/availability-blocks/${id}`, { method: 'DELETE' })
  }
  const productName = (id: string) => { const p = rentalProducts.find((x) => x.id === id); return p ? (ar ? p.name_ar : p.name_en) : id.slice(0, 6) }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-6">
          <Select value={form.product_id || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v && v !== 'none' ? v : '' }))}>
            <SelectTrigger className="sm:col-span-2"><SelectValue placeholder={ar ? 'المنتج' : 'Product'} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{ar ? 'اختر منتج' : 'Select product'}</SelectItem>
              {rentalProducts.map((p) => <SelectItem key={p.id} value={p.id}>{ar ? p.name_ar : p.name_en}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
          <Input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
          <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} placeholder={ar ? 'الكمية' : 'Qty'} />
          <Input value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder={ar ? 'السبب' : 'Reason'} />
          <Button onClick={create} disabled={saving} className="sm:col-span-6 w-fit"><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة حجب' : 'Add block'}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'المنتج' : 'Product'}</TableHead>
              <TableHead>{ar ? 'من' : 'From'}</TableHead>
              <TableHead>{ar ? 'إلى' : 'To'}</TableHead>
              <TableHead>{ar ? 'الكمية' : 'Qty'}</TableHead>
              <TableHead>{ar ? 'السبب' : 'Reason'}</TableHead>
              <TableHead />
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={6} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{productName(b.product_id)}</TableCell>
                  <TableCell>{b.start_date}</TableCell>
                  <TableCell>{b.end_date}</TableCell>
                  <TableCell>{b.quantity}</TableCell>
                  <TableCell>{b.reason || '—'}</TableCell>
                  <TableCell><button onClick={() => remove(b.id)}><Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" /></button></TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-8">{ar ? 'لا توجد حجوزات حجب بعد' : 'No availability blocks yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Collections
// ─────────────────────────────────────────────────────────────────────────
interface Collection { id: string; slug: string; name_ar: string; name_en: string; is_active: boolean }

function CollectionsTab({ items, loading, onReload }: { items: Collection[]; loading: boolean; onReload: () => void }) {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [form, setForm] = useState({ slug: '', name_ar: '', name_en: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const create = async () => {
    setFormError('')
    if (!form.slug || !form.name_ar || !form.name_en) {
      setFormError(ar ? 'يرجى ملء جميع الحقول المطلوبة (المعرف، الاسم بالعربي، الاسم بالإنجليزي)' : 'Please fill in all required fields (slug, Arabic name, English name)')
      return
    }
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      setFormError(ar ? 'المعرف (slug) يجب أن يحتوي فقط على أحرف صغيرة وأرقام وشرطة (-) بدون مسافات' : 'Slug must contain only lowercase letters, numbers, and hyphens (-) — no spaces')
      return
    }
    setSaving(true)
    try {
      await api('/api/admin/commerce/collections', { method: 'POST', body: JSON.stringify(form) })
      setForm({ slug: '', name_ar: '', name_en: '' })
      setFormError('')
      onReload()
    } catch (e) { setFormError((e as Error).message) } finally { setSaving(false) }
  }
  const toggleActive = async (c: Collection) => {
    await api(`/api/admin/commerce/collections/${c.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: !c.is_active }) })
    onReload()
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{ar ? 'مجموعات مختارة (مش تصنيفات) — منتج ممكن يكون في أكتر من مجموعة. عيّن المنتجات من داخل محرر المنتج.' : 'Curated groupings (not categories) — a product can belong to several. Assign products from within the product editor.'}</p>
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-4">
          <Input placeholder={ar ? 'المعرف (slug) — أحرف صغيرة وأرقام وشرطة فقط' : 'Slug — lowercase, numbers, hyphens only'} value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))} />
          <Input placeholder={ar ? 'الاسم بالعربي *' : 'Name (Arabic) *'} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
          <Input placeholder={ar ? 'الاسم بالإنجليزي *' : 'Name (English) *'} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
          <Button onClick={create} disabled={saving}><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة مجموعة' : 'Add collection'}</Button>
          {formError && <p className="sm:col-span-4 text-xs text-red-600 font-medium">{formError}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>{ar ? 'مفعّل' : 'Active'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{ar ? c.name_ar : c.name_en}</TableCell>
                  <TableCell dir="ltr">{c.slug}</TableCell>
                  <TableCell><Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} /></TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-8">{ar ? 'لا توجد مجموعات بعد' : 'No collections yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Delivery zones
// ─────────────────────────────────────────────────────────────────────────
interface Zone { id: string; name_ar: string; name_en: string; fee_type: 'fixed' | 'free' | 'quote'; fixed_fee: number; is_active: boolean }

function DeliveryTab() {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [items, setItems] = useState<Zone[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ name_ar: '', name_en: '', fee_type: 'fixed' as Zone['fee_type'], fixed_fee: 0 })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems((await api('/api/admin/commerce/delivery-zones')).zones || []) } finally { setLoading(false) }
  }, [api])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  const create = async () => {
    if (!form.name_ar || !form.name_en) return
    setSaving(true)
    try {
      await api('/api/admin/commerce/delivery-zones', { method: 'POST', body: JSON.stringify(form) })
      setForm({ name_ar: '', name_en: '', fee_type: 'fixed', fixed_fee: 0 })
      load()
    } catch (e) { alert((e as Error).message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-5">
          <Input placeholder={ar ? 'الاسم بالعربي' : 'Name (Arabic)'} value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />
          <Input placeholder={ar ? 'الاسم بالإنجليزي' : 'Name (English)'} value={form.name_en} onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))} />
          <Select value={form.fee_type} onValueChange={(v) => v && setForm((f) => ({ ...f, fee_type: v as Zone['fee_type'] }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="fixed">{ar ? 'رسم ثابت' : 'Fixed fee'}</SelectItem>
              <SelectItem value="free">{ar ? 'مجاني' : 'Free'}</SelectItem>
              <SelectItem value="quote">{ar ? 'عرض سعر يدوي' : 'Manual quote'}</SelectItem>
            </SelectContent>
          </Select>
          <Input type="number" placeholder={ar ? 'الرسم' : 'Fee'} value={form.fixed_fee} onChange={(e) => setForm((f) => ({ ...f, fixed_fee: Number(e.target.value) }))} disabled={form.fee_type !== 'fixed'} />
          <Button onClick={create} disabled={saving}><Plus className="h-4 w-4 mr-1" />{ar ? 'إضافة منطقة' : 'Add zone'}</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{ar ? 'الاسم' : 'Name'}</TableHead>
              <TableHead>{ar ? 'نوع الرسم' : 'Fee type'}</TableHead>
              <TableHead>{ar ? 'الرسم' : 'Fee'}</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={3} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin inline" /></TableCell></TableRow>}
              {!loading && items.map((z) => (
                <TableRow key={z.id}>
                  <TableCell className="font-medium">{ar ? z.name_ar : z.name_en}</TableCell>
                  <TableCell>{z.fee_type}</TableCell>
                  <TableCell>{z.fee_type === 'fixed' ? z.fixed_fee : '—'}</TableCell>
                </TableRow>
              ))}
              {!loading && items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-gray-400 py-8">{ar ? 'لا توجد مناطق توصيل بعد' : 'No delivery zones yet'}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Settings
// ─────────────────────────────────────────────────────────────────────────
interface CommerceSettings {
  pickup_enabled: boolean; delivery_enabled: boolean; default_currency: string
  orders_require_confirmation: boolean; online_payment_enabled: boolean
}

function SettingsTab() {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [settings, setSettings] = useState<CommerceSettings | null>(null)

  useEffect(() => { api('/api/admin/commerce/settings').then((d) => setSettings(d.settings as CommerceSettings)) }, [api])

  const update = async (patch: Partial<CommerceSettings>) => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    await api('/api/admin/commerce/settings', { method: 'PATCH', body: JSON.stringify(patch) })
  }

  if (!settings) return <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>

  return (
    <Card>
      <CardContent className="p-6 space-y-5 max-w-lg">
        <div className="flex items-center justify-between">
          <Label>{ar ? 'الاستلام من المكان' : 'Pickup'}</Label>
          <Switch checked={settings.pickup_enabled} onCheckedChange={(v) => update({ pickup_enabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{ar ? 'التوصيل' : 'Delivery'}</Label>
          <Switch checked={settings.delivery_enabled} onCheckedChange={(v) => update({ delivery_enabled: v })} />
        </div>
        <div className="flex items-center justify-between">
          <Label>{ar ? 'كل الطلبات تحتاج تأكيد يدوي' : 'Orders require manual confirmation'}</Label>
          <Switch checked={settings.orders_require_confirmation} onCheckedChange={(v) => update({ orders_require_confirmation: v })} />
        </div>
        <div className="flex items-center justify-between opacity-50">
          <Label>{ar ? 'الدفع الإلكتروني (غير مفعّل حالياً)' : 'Online payment (disabled this phase)'}</Label>
          <Switch checked={false} disabled />
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────
export function CommerceManager() {
  const locale = useLocale(); const ar = locale === 'ar'
  const api = useAdminFetch()
  const [categories, setCategories] = useState<Category[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [collections, setCollections] = useState<Collection[]>([])
  const [collectionsLoading, setCollectionsLoading] = useState(true)
  const [rentalProducts, setRentalProducts] = useState<Product[]>([])

  const loadCategories = useCallback(async () => {
    setCategoriesLoading(true)
    try { setCategories((await api('/api/admin/commerce/categories')).categories || []) } finally { setCategoriesLoading(false) }
  }, [api])
  const loadCollections = useCallback(async () => {
    setCollectionsLoading(true)
    try { setCollections((await api('/api/admin/commerce/collections')).collections || []) } finally { setCollectionsLoading(false) }
  }, [api])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    loadCategories()
  }, [loadCategories])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    loadCollections()
  }, [loadCollections])
  useEffect(() => { api('/api/admin/commerce/products?product_type=rental').then((d) => setRentalProducts((d.products as Product[]) || [])) }, [api])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-gray-900">{ar ? 'المتجر والإيجارات' : 'Commerce'}</h2>
        <p className="text-sm text-gray-500">{ar ? 'منتجات، تصنيفات، مجموعات، طلبات، إيجارات، توصيل — كل ده بمعزل عن حجوزات الإقامة' : 'Products, categories, collections, orders, rentals, delivery — separate from accommodation bookings'}</p>
      </div>
      <Tabs defaultValue="products">
        <TabsList variant="line">
          <TabsTrigger value="products">{ar ? 'المنتجات' : 'Products'}</TabsTrigger>
          <TabsTrigger value="categories">{ar ? 'التصنيفات' : 'Categories'}</TabsTrigger>
          <TabsTrigger value="collections">{ar ? 'المجموعات' : 'Collections'}</TabsTrigger>
          <TabsTrigger value="orders">{ar ? 'الطلبات' : 'Orders'}</TabsTrigger>
          <TabsTrigger value="rentals">{ar ? 'الإيجارات' : 'Rentals'}</TabsTrigger>
          <TabsTrigger value="blocks">{ar ? 'حجب التوافر' : 'Availability blocks'}</TabsTrigger>
          <TabsTrigger value="delivery">{ar ? 'التوصيل' : 'Delivery'}</TabsTrigger>
          <TabsTrigger value="settings">{ar ? 'الإعدادات' : 'Settings'}</TabsTrigger>
        </TabsList>
        <TabsContent value="products" className={cn('mt-4')}><ProductsTab categories={categories} collections={collections} /></TabsContent>
        <TabsContent value="categories" className={cn('mt-4')}><CategoriesTab items={categories} loading={categoriesLoading} onReload={loadCategories} /></TabsContent>
        <TabsContent value="collections" className={cn('mt-4')}><CollectionsTab items={collections} loading={collectionsLoading} onReload={loadCollections} /></TabsContent>
        <TabsContent value="orders" className={cn('mt-4')}><OrdersTab /></TabsContent>
        <TabsContent value="rentals" className={cn('mt-4')}><RentalsTab /></TabsContent>
        <TabsContent value="blocks" className={cn('mt-4')}><AvailabilityBlocksTab rentalProducts={rentalProducts} /></TabsContent>
        <TabsContent value="delivery" className={cn('mt-4')}><DeliveryTab /></TabsContent>
        <TabsContent value="settings" className={cn('mt-4')}><SettingsTab /></TabsContent>
      </Tabs>
    </div>
  )
}
