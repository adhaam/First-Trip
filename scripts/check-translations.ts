import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { V2_NAMESPACES } from '../src/messages/namespaces'

type Messages = Record<string, unknown>

function leafKeys(value: Messages, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (child && typeof child === 'object' && !Array.isArray(child)) {
      return leafKeys(child as Messages, path)
    }
    return [path]
  })
}

function readJson(...segments: string[]) {
  return JSON.parse(readFileSync(resolve(process.cwd(), 'src', 'messages', ...segments), 'utf8')) as Messages
}

// Mirrors src/i18n/request.ts: legacy file + one file per V2 namespace.
function readMessages(locale: 'ar' | 'en') {
  const messages = readJson(`${locale}.json`)
  for (const ns of V2_NAMESPACES) {
    assert.ok(!(ns in messages), `Namespace "${ns}" collides with a legacy key in ${locale}.json`)
    messages[ns] = readJson(locale, `${ns}.json`)
  }
  return messages
}

const ar = readMessages('ar')
const en = readMessages('en')
const arKeys = leafKeys(ar).sort()
const enKeys = leafKeys(en).sort()

assert.deepEqual(arKeys, enKeys, 'Arabic and English translation keys must have exact parity')

// An Arabic value that is identical to the English one (and contains Latin
// letters) is almost always an untranslated copy-paste.
const lookup = (messages: Messages, path: string) =>
  path.split('.').reduce<unknown>((node, key) => (node as Messages)?.[key], messages)
const untranslated = arKeys.filter((path) => {
  if (!V2_NAMESPACES.some((ns) => path.startsWith(`${ns}.`))) return false
  const a = lookup(ar, path)
  const e = lookup(en, path)
  return typeof a === 'string' && a === e && /[A-Za-z]{4,}/.test(a) && !/WEEMAP|Signature|EGP|WhatsApp/.test(a)
})
assert.deepEqual(untranslated, [], `V2 Arabic strings identical to English: ${untranslated.join(', ')}`)

console.log(`Translation parity verified: ${arKeys.length} leaf keys in each locale.`)
