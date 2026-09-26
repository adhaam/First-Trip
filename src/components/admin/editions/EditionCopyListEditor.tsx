'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { EditionCopyItem } from '@/lib/editions'

type Props = {
  label: string
  items: EditionCopyItem[]
  onChange: (items: EditionCopyItem[]) => void
}

/** Add/remove editor for a bilingual copy list (Includes / Excludes) — no JSON editing. */
export function EditionCopyListEditor({ label, items, onChange }: Props) {
  const [en, setEn] = useState('')
  const [ar, setAr] = useState('')

  const add = () => {
    if (!en.trim() || !ar.trim()) return
    onChange([...items, { en: en.trim(), ar: ar.trim() }])
    setEn('')
    setAr('')
  }
  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div>
      <Label>{label}</Label>
      <ul className="mt-2 space-y-2">
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
            <span className="flex-1">{item.en}</span>
            <span className="flex-1 text-right" dir="rtl">{item.ar}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <Input value={en} onChange={(e) => setEn(e.target.value)} placeholder="English" />
        <Input value={ar} onChange={(e) => setAr(e.target.value)} placeholder="عربي" dir="rtl" />
        <Button type="button" variant="outline" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
