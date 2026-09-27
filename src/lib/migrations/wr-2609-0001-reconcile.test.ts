import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const dir = 'scripts/maintenance/2026-09-27_wr-2609-0001_reconcile'
const reconcile = readFileSync(`${dir}.sql`, 'utf8')
const reverse = readFileSync(`${dir}.REVERSE.sql`, 'utf8')
const dryRun = readFileSync(`${dir}.dry-run.sql`, 'utf8')
const code = (sql: string) => sql.replace(/--.*$/gm, '')

test('the ledger stays append-only: no script updates or deletes payment_records', () => {
  for (const sql of [reconcile, reverse, dryRun]) {
    assert.doesNotMatch(code(sql), /UPDATE\s+public\.payment_records/i)
    assert.doesNotMatch(code(sql), /DELETE\s+FROM\s+public\.payment_records/i)
  }
})

test('the dry-run only reads', () => {
  assert.doesNotMatch(code(dryRun), /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\b/i)
})

test('the reconcile is one guarded transaction that pairs its two transfer entries with the original', () => {
  const body = code(reconcile)
  assert.match(body, /^\s*BEGIN;/m)
  assert.match(body, /^\s*COMMIT;/m)
  assert.equal((body.match(/INSERT INTO public\.payment_records/g) ?? []).length, 2)
  assert.equal((body.match(/'transfer:' \|\| c_original::text/g) ?? []).length, 2)
  assert.match(body, /precondition: migration 049 is not applied/)
  assert.match(body, /expected exactly 1 ledger entry on this journey/)
  assert.match(body, /postcondition: journey is not 16,300 \/ 5,000 \/ partial/)
})

test('the reconcile only writes rows of WR-2609-0001 and its test customer', () => {
  const ids = new Set([
    'c_request', 'c_booking', 'c_customer', 'c_trips',
  ])
  for (const match of code(reconcile).matchAll(/UPDATE public\.(\w+)[\s\S]*?WHERE ([^;]+);/g)) {
    assert.ok([...ids].some((id) => match[2].includes(id)), `unscoped UPDATE on ${match[1]}: ${match[2]}`)
  }
})
