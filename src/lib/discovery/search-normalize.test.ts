import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSearchText, searchTokens, normalizeArabicLetters, normalizeArabicQuery, searchQueryVariants, stripArabicDiacritics } from './search-normalize'

test('stripArabicDiacritics removes tashkeel and tatweel, keeps letters', () => {
  assert.equal(stripArabicDiacritics('دَهَبْ'), 'دهب')
  assert.equal(stripArabicDiacritics('الـــبحر'), 'البحر')
})

test('stripArabicDiacritics is a no-op on plain text', () => {
  assert.equal(stripArabicDiacritics('Dahab'), 'Dahab')
  assert.equal(stripArabicDiacritics('البحر الأحمر'), 'البحر الأحمر')
})

test('normalizeArabicLetters unifies alef/hamza forms', () => {
  assert.equal(normalizeArabicLetters('أحمد'), 'احمد')
  assert.equal(normalizeArabicLetters('إسلام'), 'اسلام')
  assert.equal(normalizeArabicLetters('آمنة'), 'امنة'.replace('ة', 'ه'))
})

test('normalizeArabicLetters maps alef maqsura to ya and ta marbuta to ha', () => {
  assert.equal(normalizeArabicLetters('مصطفى'), 'مصطفي')
  assert.equal(normalizeArabicLetters('لاجونة'), 'لاجونه')
})

test('normalizeArabicQuery combines diacritic stripping, letter normalisation and whitespace collapse', () => {
  assert.equal(normalizeArabicQuery('  دَهَب   البُحَيرة  '), 'دهب البحيره')
})

test('searchQueryVariants returns only the original when normalisation changes nothing', () => {
  assert.deepEqual(searchQueryVariants('dahab'), ['dahab'])
})

test('searchQueryVariants returns original + normalised when they differ', () => {
  const variants = searchQueryVariants('لاجونة')
  assert.deepEqual(variants, ['لاجونة', 'لاجونه'])
})

test('searchQueryVariants never returns more than 2 variants', () => {
  const variants = searchQueryVariants('أحمد إسلام آمنة')
  assert.ok(variants.length <= 2)
})

// Must agree with public.weemap_search_normalize (supabase/tests/public_search.sql
// asserts the same samples on the SQL side).
test('normalizeSearchText mirrors the database normaliser', () => {
  assert.equal(normalizeSearchText('رحلة رأس أبو جلوم البدويّة'), 'رحله راس ابو جلوم البدويه')
  assert.equal(normalizeSearchText('Blue HOLE'), 'blue hole')
  assert.equal(normalizeSearchText('مـــصر إلى'), 'مصر الي')
})

test('searchTokens: normalised, de-duplicated, bounded, single letters dropped from phrases', () => {
  assert.deepEqual(searchTokens('ابو جلوم'), ['ابو', 'جلوم'])
  assert.deepEqual(searchTokens('أبو  أبو جلوم'), ['ابو', 'جلوم'])
  assert.deepEqual(searchTokens('a blue hole'), ['blue', 'hole'])
  assert.deepEqual(searchTokens('one two three four five six seven'), ['one', 'two', 'three', 'four', 'five'])
})
