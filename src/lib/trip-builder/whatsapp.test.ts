import assert from 'node:assert/strict'
import test from 'node:test'
import type { BuilderCatalog } from './types'
import { buildHandoffMessage, whatsappLink } from './whatsapp'

test('WhatsApp links preserve digits and encode message text', () => {
  assert.equal(whatsappLink('+20 (100) 123-4567', 'Hello & welcome'), 'https://wa.me/201001234567?text=Hello%20%26%20welcome')
})

test('handoff message uses the recommended rooms in auto mode and custom rooms otherwise', () => {
  const catalog = { governorates: [], accommodations: [], trips: [], packages: [] } as unknown as BuilderCatalog
  const state = { adults: 3, children: 0, experiences: [], contact: {} }
  const recommended = [{ type: 'triple' as const, count: 1 }]
  assert.match(buildHandoffMessage({ state, catalog, locale: 'en', recommendedRooms: recommended }), /Rooms: 1 triple/)
  assert.doesNotMatch(buildHandoffMessage({ state, catalog, locale: 'en' }), /Rooms:/)
  const custom = { ...state, room_allocations: [{ type: 'single' as const, count: 3 }] }
  assert.match(buildHandoffMessage({ state: custom, catalog, locale: 'en', recommendedRooms: recommended }), /Rooms: 3 single/)
})
