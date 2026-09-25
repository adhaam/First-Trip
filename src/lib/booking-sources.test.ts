import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BOOKING_SOURCES,
  DEFAULT_STAFF_BOOKING_SOURCE,
  STAFF_BOOKING_SOURCES,
} from './booking-sources'

const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

function sourceCheckValues(file: string, statementPattern: RegExp): string[] {
  const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
  const statement = statementPattern.exec(sql)
  assert.ok(statement, `missing source CHECK statement in ${file}`)
  const match = /CHECK\s*\(\s*source\s+IN\s*\(([^)]*)\)\s*\)/i.exec(statement[0])
  assert.ok(match, `missing source CHECK list in ${file}`)
  return match[1]
    .split(',')
    .map((value) => value.trim().replace(/^'(.*)'$/, '$1'))
    .filter(Boolean)
}

test('BOOKING_SOURCES exactly matches the bookings (004) and trip_bookings (013) source CHECK lists', () => {
  const bookings = sourceCheckValues(
    '004_weemap_pricing_engine_v2.sql',
    /ALTER\s+TABLE\s+bookings\s+ADD\s+CONSTRAINT\s+bookings_source_check[\s\S]*?;/i,
  )
  const tripBookings = sourceCheckValues(
    '013_unified_commerce_foundation.sql',
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?trip_bookings\s*\([\s\S]*?\);/i,
  )

  assert.deepEqual(bookings, tripBookings, 'bookings and trip_bookings source CHECK lists drifted')
  assert.deepEqual(bookings, [...BOOKING_SOURCES], 'BOOKING_SOURCES drifted from the database CHECK list')
})

test('BOOKING_SOURCES has no duplicates', () => {
  assert.equal(new Set(BOOKING_SOURCES).size, BOOKING_SOURCES.length)
})

test('staff channels are every allowed source except website', () => {
  assert.deepEqual(
    [...STAFF_BOOKING_SOURCES],
    BOOKING_SOURCES.filter((s) => s !== 'website'),
  )
  assert.ok((BOOKING_SOURCES as readonly string[]).includes(DEFAULT_STAFF_BOOKING_SOURCE))
  assert.equal(DEFAULT_STAFF_BOOKING_SOURCE, 'manual')
})

test("the legacy 'admin' value is not an allowed source", () => {
  assert.ok(!(BOOKING_SOURCES as readonly string[]).includes('admin'))
})
