import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

function readMessages(locale: 'ar' | 'en') {
  const file = resolve(process.cwd(), 'src', 'messages', `${locale}.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as Messages
}

const arKeys = leafKeys(readMessages('ar')).sort()
const enKeys = leafKeys(readMessages('en')).sort()

assert.deepEqual(arKeys, enKeys, 'Arabic and English translation keys must have exact parity')
console.log(`Translation parity verified: ${arKeys.length} leaf keys in each locale.`)
