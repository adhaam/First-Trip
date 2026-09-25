import assert from 'node:assert/strict'
import test from 'node:test'
import { clearDraft, loadDraft, saveDraft } from './storage'

test('storage round-trips valid drafts and drops corrupt data', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
  saveDraft(storage, { locale: 'en', adults: 2, children: 0, experiences: [] })
  assert.equal(loadDraft(storage)?.adults, 2)
  values.set('weemap.tripBuilder.v1', '{bad')
  assert.equal(loadDraft(storage), undefined)
  clearDraft(storage)
  assert.equal(values.has('weemap.tripBuilder.v1'), false)
})
