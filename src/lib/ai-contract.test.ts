import assert from 'node:assert/strict'
import test from 'node:test'
import {
  aiChatRequestSchema,
  aiLeadSchema,
  isAiFeatureEnabled,
  isValidAiWebhookUrl,
  parseAiUpstreamResponse,
  sameOriginPath,
} from './ai-contract'

const sessionId = '123e4567-e89b-12d3-a456-426614174000'

test('accepts the exact website to n8n chat contract', () => {
  const parsed = aiChatRequestSchema.safeParse({
    sessionId,
    message: '  What trips are available?  ',
    locale: 'en',
    page: { url: '/sinai-trips', type: 'trips' },
  })
  assert.equal(parsed.success, true)
  if (parsed.success) assert.equal(parsed.data.message, 'What trips are available?')
})

test('rejects malformed chat context and unexpected fields', () => {
  assert.equal(aiChatRequestSchema.safeParse({
    sessionId,
    message: 'Hello',
    locale: 'en',
    page: { url: '/sinai-trips', type: 'invalid' },
  }).success, false)
  assert.equal(aiChatRequestSchema.safeParse({
    sessionId,
    message: 'Hello',
    locale: 'en',
    page: { url: '/sinai-trips', type: 'trips' },
    internal: true,
  }).success, false)
})

test('normalizes supported international phone formats and keeps email optional', () => {
  const parsed = aiLeadSchema.safeParse({
    sessionId,
    name: '  Ada   Lovelace ',
    whatsapp: '+20 (100) 123-4567',
    email: '',
    locale: 'en',
    initialPageUrl: '/sinai-trips',
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal(parsed.data.name, 'Ada Lovelace')
    assert.equal(parsed.data.whatsapp, '+201001234567')
  }
  assert.equal(aiLeadSchema.safeParse({
    sessionId,
    name: 'Ada',
    whatsapp: '123',
    locale: 'en',
    initialPageUrl: '/',
  }).success, false)
})

test('accepts only same-session, bounded, exact upstream responses', () => {
  assert.deepEqual(parseAiUpstreamResponse({ message: 'Confirmed.', sessionId, actions: [] }, sessionId), {
    message: 'Confirmed.',
    sessionId,
    actions: [],
  })
  assert.equal(parseAiUpstreamResponse({ message: 'Wrong session', sessionId: crypto.randomUUID() }, sessionId), null)
  assert.equal(parseAiUpstreamResponse({ message: 'Extra data', sessionId, actions: [], debug: true }, sessionId), null)
  assert.equal(parseAiUpstreamResponse({ message: '', sessionId }, sessionId), null)
})

test('normalizes same-origin page URLs and rejects external origins', () => {
  assert.equal(sameOriginPath('https://weemapsinai.com/en/sinai-trips?q=sea#gallery', 'https://weemapsinai.com'), '/en/sinai-trips?q=sea')
  assert.equal(sameOriginPath('/sinai-trips', 'https://weemapsinai.com'), '/sinai-trips')
  assert.equal(sameOriginPath('https://example.com/steal', 'https://weemapsinai.com'), null)
})

test('feature flag and webhook URL checks fail closed', () => {
  assert.equal(isAiFeatureEnabled('true'), true)
  assert.equal(isAiFeatureEnabled('TRUE'), false)
  assert.equal(isAiFeatureEnabled(undefined), false)
  assert.equal(isValidAiWebhookUrl('https://n8n.example.com/webhook/chat'), true)
  assert.equal(isValidAiWebhookUrl('http://localhost:5678/webhook-test/chat'), true)
  assert.equal(isValidAiWebhookUrl('http://n8n.example.com/webhook/chat'), false)
})
