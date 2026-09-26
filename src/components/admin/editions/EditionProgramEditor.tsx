'use client'

import { useState } from 'react'
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import type { EditionProgramItem } from '@/lib/editions'

type Props = {
  program: EditionProgramItem[]
  onChange: (program: EditionProgramItem[]) => void
}

const emptyItem: EditionProgramItem = {
  label_en: '', label_ar: '', title_en: '', title_ar: '', description_en: '', description_ar: '',
}

/**
 * Add/remove/move-up/move-down editor for the program — array order IS the
 * displayed order (no separate sort_order field), so "move" just swaps
 * array positions.
 */
export function EditionProgramEditor({ program, onChange }: Props) {
  const [draft, setDraft] = useState<EditionProgramItem>(emptyItem)

  const add = () => {
    if (!draft.title_en.trim() || !draft.title_ar.trim()) return
    onChange([...program, draft])
    setDraft(emptyItem)
  }
  const remove = (index: number) => onChange(program.filter((_, i) => i !== index))
  const move = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= program.length) return
    const next = [...program]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div>
      <Label>Program</Label>
      <ol className="mt-2 space-y-2">
        {program.map((item, index) => (
          <li key={index} className="flex items-start gap-2 rounded-md border border-border p-3 text-sm">
            <div className="flex-1">
              <p className="font-semibold">{item.title_en} / {item.title_ar}</p>
              {item.description_en && <p className="mt-1 text-muted-foreground">{item.description_en}</p>}
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <Button type="button" size="icon" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0}>
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => move(index, 1)}
                disabled={index === program.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-3 grid gap-2 rounded-md border border-dashed border-border p-3 sm:grid-cols-2">
        <Input
          value={draft.label_en}
          onChange={(e) => setDraft({ ...draft, label_en: e.target.value })}
          placeholder="Label (EN), e.g. Day 1"
        />
        <Input
          value={draft.label_ar}
          onChange={(e) => setDraft({ ...draft, label_ar: e.target.value })}
          placeholder="التسمية (AR)"
          dir="rtl"
        />
        <Input
          value={draft.title_en}
          onChange={(e) => setDraft({ ...draft, title_en: e.target.value })}
          placeholder="Title (EN)"
        />
        <Input
          value={draft.title_ar}
          onChange={(e) => setDraft({ ...draft, title_ar: e.target.value })}
          placeholder="العنوان (AR)"
          dir="rtl"
        />
        <Textarea
          value={draft.description_en}
          onChange={(e) => setDraft({ ...draft, description_en: e.target.value })}
          placeholder="Description (EN)"
          rows={2}
        />
        <Textarea
          value={draft.description_ar}
          onChange={(e) => setDraft({ ...draft, description_ar: e.target.value })}
          placeholder="الوصف (AR)"
          dir="rtl"
          rows={2}
        />
        <Button type="button" variant="outline" className="sm:col-span-2" onClick={add}>
          <Plus className="h-4 w-4" />
          Add step
        </Button>
      </div>
    </div>
  )
}
