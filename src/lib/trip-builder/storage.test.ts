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

test('a custom hiace draft (no stay_pattern_code, explicit departure_date) survives a reload', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
  saveDraft(storage, {
    locale: 'en', adults: 2, children: 0, experiences: [],
    transport_mode: 'hiace', origin_governorate_code: 'CAI',
    arrival_date: '2026-10-07', departure_date: '2026-10-12',
  })
  const loaded = loadDraft(storage)
  assert.equal(loaded?.transport_mode, 'hiace')
  assert.equal(loaded?.stay_pattern_code, undefined)
  assert.equal(loaded?.arrival_date, '2026-10-07')
  assert.equal(loaded?.departure_date, '2026-10-12')
})
