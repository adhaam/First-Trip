import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { DOMAIN_EVENT_TYPES } from './domain-events'

const migration = readFileSync(
  new URL('../../supabase/migrations/031_request_workflow_history_events.sql', import.meta.url),
  'utf8',
)

function functionBody(name: string) {
  const match = migration.match(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?AS \\$\\$([\\s\\S]*?)\\$\\$;`),
  )
  assert.ok(match, `Could not find function ${name} in migration`)
  return match[1]
}

function quotedSnakeCaseTokens(source: string) {
  return [...source.matchAll(/'([a-z]+(?:_[a-z]+)*)'/g)].map((match) => match[1])
}

function emittedEventTypes() {
  const createdEvent = functionBody('weemap_created_event')
  const statusEvents = functionBody('weemap_status_events')
  const recordChange = functionBody('weemap_record_request_change')
  const events = new Set<string>()

  for (const match of createdEvent.matchAll(/\b(?:THEN|ELSE)\s+'([a-z]+(?:_[a-z]+)*)'/g)) {
    events.add(match[1])
  }

  for (const array of statusEvents.matchAll(/\bARRAY\s*\[([^\]]*)\]/g)) {
    for (const eventType of quotedSnakeCaseTokens(array[1])) events.add(eventType)
  }

  for (const match of recordChange.matchAll(/\bVALUES\s*\(\s*'([a-z]+(?:_[a-z]+)*)'/g)) {
    events.add(match[1])
  }

  return events
}

// Migration 036 adds events written directly by its RPCs and customer trigger.
function operationsCenterEventTypes() {
  const operations = readFileSync(
    new URL('../../supabase/migrations/036_operations_center.sql', import.meta.url),
    'utf8',
  )
  const events = new Set<string>()
  const inserts = /INSERT INTO (?:public\.)?domain_events[\s\S]*?VALUES\s*\(([\s\S]*?),/g
  for (const insert of operations.matchAll(inserts)) {
    const literal = insert[1].trim().match(/^'([a-z]+(?:_[a-z]+)*)'$/)
    if (literal) events.add(literal[1])
    for (const branch of insert[1].matchAll(/\b(?:THEN|ELSE)\s+'([a-z]+(?:_[a-z]+)*)'/g)) {
      events.add(branch[1])
    }
  }
  return events
}

test('DOMAIN_EVENT_TYPES exactly matches the database outbox event vocabulary', () => {
  const sqlEventTypes = new Set([...emittedEventTypes(), ...operationsCenterEventTypes()])
  const typeScriptEventTypes = new Set(DOMAIN_EVENT_TYPES)

  assert.deepEqual([...typeScriptEventTypes].sort(), [...sqlEventTypes].sort())
})
