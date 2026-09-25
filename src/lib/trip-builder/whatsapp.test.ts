import assert from 'node:assert/strict'
import test from 'node:test'
import { whatsappLink } from './whatsapp'

test('WhatsApp links preserve digits and encode message text', () => {
  assert.equal(whatsappLink('+20 (100) 123-4567', 'Hello & welcome'), 'https://wa.me/201001234567?text=Hello%20%26%20welcome')
})
