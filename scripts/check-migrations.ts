/**
 * Static checks on supabase/migrations — run in CI and before adding a file.
 *
 *  - every migration file is named NNN_snake_case.sql
 *  - numbers are unique and contiguous from 001 (a duplicate number is what
 *    once hid production drift — see supabase/migrations/README.md)
 *  - every file opens with a comment explaining why it exists
 *
 * The full "does the chain rebuild an empty database" check needs Docker and
 * lives in scripts/db-bootstrap-check.sh.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'supabase', 'migrations')
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
const problems: string[] = []
const seen = new Map<number, string>()

for (const file of files) {
  const match = /^(\d{3})_[a-z0-9_]+\.sql$/.exec(file)
  if (!match) {
    problems.push(`${file}: name must be NNN_snake_case.sql`)
    continue
  }
  const n = Number(match[1])
  const clash = seen.get(n)
  if (clash) problems.push(`${file}: number ${match[1]} already used by ${clash}`)
  seen.set(n, file)

  const firstLine = readFileSync(join(dir, file), 'utf8').replace(/^﻿/, '').split(/\r?\n/, 1)[0]
  if (!firstLine.startsWith('--')) problems.push(`${file}: must start with a header comment`)
}

const numbers = [...seen.keys()].sort((a, b) => a - b)
numbers.forEach((n, i) => {
  if (n !== i + 1) problems.push(`gap in numbering: expected ${String(i + 1).padStart(3, '0')}, found ${String(n).padStart(3, '0')}`)
})

if (problems.length) {
  console.error(`Migration check failed:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`Migrations OK: ${files.length} files, 001–${String(numbers.at(-1)).padStart(3, '0')}.`)
