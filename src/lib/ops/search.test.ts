import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeOpsQuery } from './search'

test('normalizes whitespace, Arabic variants, tashkeel and PostgREST grammar', () => {
  assert.deepEqual(normalizeOpsQuery('  أَلْفــا  %(test)_ '), { text: 'الفا test', digits: null })
})

test('normalizes Arabic-Indic phone digits only when useful for matching', () => {
  assert.deepEqual(normalizeOpsQuery('٠١٠-١٢٣٤-٥٦٧٨'), { text: '٠١٠-١٢٣٤-٥٦٧٨', digits: '01012345678' })
  assert.equal(normalizeOpsQuery('12 3').digits, null)
})
