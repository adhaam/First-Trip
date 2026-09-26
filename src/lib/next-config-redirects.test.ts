// ─── next.config.ts Signature → Editions redirect coverage ───
// Run with:  npx tsx --test src/lib/next-config-redirects.test.ts
//
// next.config.ts wraps its export in next-intl's plugin and isn't meant to
// be imported at test time, so this checks the committed source text for
// the exact redirect entries rather than executing the config — enough to
// catch someone deleting or renaming a redirect without checking here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'next.config.ts'), 'utf8')

test('redirects the unprefixed (Arabic default-locale) Signature landing to Editions', () => {
  assert.match(source, /source:\s*'\/signature',\s*\n\s*destination:\s*'\/editions',\s*\n\s*permanent:\s*true,/)
})

test('redirects the locale-prefixed Signature landing to Editions', () => {
  const pattern = new RegExp(
    "source:\\s*'/:locale\\(en\\|ar\\)/signature',\\s*\\n"
      + "\\s*destination:\\s*'/:locale/editions',\\s*\\n\\s*permanent:\\s*true,",
  )
  assert.match(source, pattern)
})

test('redirects the unprefixed Signature build wizard to the Custom Edition flow', () => {
  const pattern = new RegExp(
    "source:\\s*'/signature/build',\\s*\\n"
      + "\\s*destination:\\s*'/editions/custom',\\s*\\n\\s*permanent:\\s*true,",
  )
  assert.match(source, pattern)
})

test('redirects the locale-prefixed Signature build wizard to the Custom Edition flow', () => {
  const pattern = new RegExp(
    "source:\\s*'/:locale\\(en\\|ar\\)/signature/build',\\s*\\n"
      + "\\s*destination:\\s*'/:locale/editions/custom',\\s*\\n\\s*permanent:\\s*true,",
  )
  assert.match(source, pattern)
})

test('does not redirect /signature/[slug] — historical experience links must keep working', () => {
  // No redirect entry with a source of exactly '/signature/:slug' or a
  // wildcard under /signature — only the two exact paths above are redirected.
  assert.doesNotMatch(source, /source:\s*'\/signature\/:/)
  assert.doesNotMatch(source, /source:\s*'\/signature\/\*/)
})
