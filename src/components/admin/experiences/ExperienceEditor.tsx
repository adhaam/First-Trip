'use client'

// Admin UI is English-only by product decision; the *content* it edits is
// bilingual, which is why nearly every field comes as an AR/EN pair.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import {
  EXPERIENCE_CURRENCIES,
  EXPERIENCE_STATUSES,
  slugifyExperience,
  type Experience,
  type ExperienceCategory,
  type ItineraryDay,
} from '@/lib/experiences'

export type ExperienceDraft = Partial<Experience>

export const EMPTY_EXPERIENCE: ExperienceDraft = {
  title_ar: '', title_en: '', category: 'other', partner_name: '',
  partner_description_ar: '', partner_description_en: '',
  short_description_ar: '', short_description_en: '',
  full_description_ar: '', full_description_en: '',
  included_ar: [], included_en: [], not_included_ar: [], not_included_en: [],
  itinerary: [], hero_image: '', gallery: [],
  duration_ar: '', duration_en: '',
  price: 0, currency: 'EGP', status: 'draft', sort_order: 0,
  discount_value: null, discount_type: null, discount_label: '',
}

interface ExperienceEditorProps {
  value: ExperienceDraft
  categories: ExperienceCategory[]
  saving: boolean
  error: string
  onChange: (next: ExperienceDraft) => void
  onSave: () => void
  onCancel: () => void
}

export function ExperienceEditor({
  value, categories, saving, error, onChange, onSave, onCancel,
}: ExperienceEditorProps) {
  const set = <K extends keyof Experience>(key: K, next: Experience[K]) =>
    onChange({ ...value, [key]: next })

  const gallery = value.gallery ?? []
  const itinerary = value.itinerary ?? []

  return (
    <div className="space-y-8 rounded-xl border bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {value.id ? 'Edit experience' : 'New experience'}
        </h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Basics */}
      <section className="space-y-4">
        <SectionTitle>Basics</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Title (English)" required>
            <Input
              value={value.title_en ?? ''}
              onChange={(e) => set('title_en', e.target.value)}
              placeholder="Discover Scuba | Dahab"
            />
          </Field>
          <Field label="Title (Arabic)" required>
            <Input
              dir="rtl"
              value={value.title_ar ?? ''}
              onChange={(e) => set('title_ar', e.target.value)}
              placeholder="جرّب الغوص | دهب"
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Category">
            <Select value={value.category ?? 'other'} onValueChange={(v) => set('category', v ?? 'other')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>{c.label_en} — {c.label_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select value={value.status ?? 'draft'} onValueChange={(v) => v && set('status', v as Experience['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'draft' ? 'Draft' : 'Published'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Sort order" hint="Lower shows first">
            <Input
              type="number"
              value={value.sort_order ?? 0}
              onChange={(e) => set('sort_order', parseInt(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Price per person" required>
            <Input
              type="number"
              min={0}
              value={value.price ?? 0}
              onChange={(e) => set('price', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Currency">
            <Select value={value.currency ?? 'EGP'} onValueChange={(v) => v && set('currency', v as Experience['currency'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPERIENCE_CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Discount value" hint="Leave empty for no discount">
            <Input
              type="number" min={0}
              value={value.discount_value ?? ''}
              placeholder="No discount"
              onChange={(e) => set('discount_value' as keyof Experience, e.target.value === '' ? null : (Number(e.target.value) || 0) as never)}
            />
          </Field>
          <Field label="Discount type">
            <Select value={value.discount_type || '_none'} onValueChange={(v) => set('discount_type' as keyof Experience, (v === '_none' ? null : v) as never)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">No discount</SelectItem>
                <SelectItem value="amount">Fixed amount (EGP)</SelectItem>
                <SelectItem value="percentage">Percentage %</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Slug" hint="Auto-generated from the English title if left blank">
            <Input
              dir="ltr"
              value={value.slug ?? ''}
              onChange={(e) => set('slug', e.target.value)}
              onBlur={(e) => e.target.value && set('slug', slugifyExperience(e.target.value))}
              placeholder="discover-scuba-dahab"
            />
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Duration (English)" hint="Optional — derived from the trip dates when blank">
            <Input value={value.duration_en ?? ''} onChange={(e) => set('duration_en', e.target.value)} placeholder="3 days / 2 nights" />
          </Field>
          <Field label="Duration (Arabic)">
            <Input dir="rtl" value={value.duration_ar ?? ''} onChange={(e) => set('duration_ar', e.target.value)} placeholder="٣ أيام / ليلتين" />
          </Field>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-4">
        <SectionTitle>Partner</SectionTitle>
        <Field label="Partner name">
          <Input value={value.partner_name ?? ''} onChange={(e) => set('partner_name', e.target.value)} placeholder="Sinai Divers" />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Partner description (English)">
            <Textarea rows={3} value={value.partner_description_en ?? ''} onChange={(e) => set('partner_description_en', e.target.value)} placeholder="PADI certified dive centre, running since 1994." />
          </Field>
          <Field label="Partner description (Arabic)">
            <Textarea rows={3} dir="rtl" value={value.partner_description_ar ?? ''} onChange={(e) => set('partner_description_ar', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Descriptions */}
      <section className="space-y-4">
        <SectionTitle>Descriptions</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Short description (English)" hint="Shown on the card — keep it to two lines">
            <Textarea rows={3} maxLength={400} value={value.short_description_en ?? ''} onChange={(e) => set('short_description_en', e.target.value)} />
          </Field>
          <Field label="Short description (Arabic)">
            <Textarea rows={3} dir="rtl" maxLength={400} value={value.short_description_ar ?? ''} onChange={(e) => set('short_description_ar', e.target.value)} />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full description (English)" hint="Shown on the experience page">
            <Textarea rows={7} value={value.full_description_en ?? ''} onChange={(e) => set('full_description_en', e.target.value)} />
          </Field>
          <Field label="Full description (Arabic)">
            <Textarea rows={7} dir="rtl" value={value.full_description_ar ?? ''} onChange={(e) => set('full_description_ar', e.target.value)} />
          </Field>
        </div>
      </section>

      {/* Included / not included */}
      <section className="space-y-4">
        <SectionTitle>What&apos;s included</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <ListEditor label="Included (English)" items={value.included_en ?? []} onChange={(v) => set('included_en', v)} />
          <ListEditor label="Included (Arabic)" rtl items={value.included_ar ?? []} onChange={(v) => set('included_ar', v)} />
        </div>
        <SectionTitle>What&apos;s NOT included</SectionTitle>
        <div className="grid gap-6 md:grid-cols-2">
          <ListEditor label="Not included (English)" items={value.not_included_en ?? []} onChange={(v) => set('not_included_en', v)} />
          <ListEditor label="Not included (Arabic)" rtl items={value.not_included_ar ?? []} onChange={(v) => set('not_included_ar', v)} />
        </div>
      </section>

      {/* Itinerary */}
      <section className="space-y-4">
        <SectionTitle>Day-by-day itinerary</SectionTitle>
        {itinerary.length === 0 && <p className="text-sm text-gray-500">No days added yet.</p>}
        <div className="space-y-4">
          {itinerary.map((day, index) => (
            <div key={index} className="rounded-lg border bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700">Day {day.day}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    set(
                      'itinerary',
                      itinerary
                        .filter((_, i) => i !== index)
                        .map((d, i) => ({ ...d, day: i + 1 })),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Title (English)"
                  value={day.title_en}
                  onChange={(e) => set('itinerary', patchDay(itinerary, index, { title_en: e.target.value }))}
                />
                <Input
                  dir="rtl"
                  placeholder="العنوان بالعربي"
                  value={day.title_ar}
                  onChange={(e) => set('itinerary', patchDay(itinerary, index, { title_ar: e.target.value }))}
                />
                <Textarea
                  rows={3}
                  placeholder="Description (English)"
                  value={day.description_en}
                  onChange={(e) => set('itinerary', patchDay(itinerary, index, { description_en: e.target.value }))}
                />
                <Textarea
                  rows={3}
                  dir="rtl"
                  placeholder="الوصف بالعربي"
                  value={day.description_ar}
                  onChange={(e) => set('itinerary', patchDay(itinerary, index, { description_ar: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            set('itinerary', [
              ...itinerary,
              { day: itinerary.length + 1, title_ar: '', title_en: '', description_ar: '', description_en: '' },
            ])
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add day
        </Button>
      </section>

      {/* Media */}
      <section className="space-y-4">
        <SectionTitle>Media</SectionTitle>
        <Field label="Hero image URL">
          <Input dir="ltr" value={value.hero_image ?? ''} onChange={(e) => set('hero_image', e.target.value)} placeholder="https://…" />
        </Field>
        <div>
          <Label className="mb-2 block text-sm">Gallery ({gallery.length}/6)</Label>
          <div className="space-y-2">
            {gallery.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  dir="ltr"
                  value={url}
                  onChange={(e) => set('gallery', gallery.map((g, i) => (i === index ? e.target.value : g)))}
                  placeholder="https://…"
                />
                <Button variant="ghost" size="sm" onClick={() => set('gallery', gallery.filter((_, i) => i !== index))}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
          </div>
          {gallery.length < 6 && (
            <Button variant="outline" size="sm" className="mt-2" onClick={() => set('gallery', [...gallery, ''])}>
              <Plus className="mr-2 h-4 w-4" />
              Add image
            </Button>
          )}
        </div>
      </section>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3 border-t pt-4">
        <Button onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {value.id ? 'Save changes' : 'Create experience'}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </div>
  )
}

function patchDay(days: ItineraryDay[], index: number, patch: Partial<ItineraryDay>): ItineraryDay[] {
  return days.map((d, i) => (i === index ? { ...d, ...patch } : d))
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="border-b pb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{children}</h4>
}

function Field({
  label, hint, required, children,
}: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function ListEditor({
  label, items, rtl, onChange,
}: { label: string; items: string[]; rtl?: boolean; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value) return
    onChange([...items, value])
    setDraft('')
  }

  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <ul className="mb-2 space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-sm">
            <span dir={rtl ? 'rtl' : 'ltr'} className="flex-1">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, i) => i !== index))}
              aria-label={`Remove ${item}`}
              className="text-gray-400 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input
          dir={rtl ? 'rtl' : 'ltr'}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder="Add an item and press Enter"
        />
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
