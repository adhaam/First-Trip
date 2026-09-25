import assert from 'node:assert/strict'
import test from 'node:test'
import { createAdminSessionToken, SESSION_MS, verifyAdminSessionToken } from './admin-session'

process.env.ADMIN_SESSION_SECRET = 'test-secret-for-admin-session'

const claims = { sid: '11111111-2222-4333-8444-555555555555', ver: 3, role: 'operations' as const }

test('a token round-trips its claims', async () => {
  const token = await createAdminSessionToken(claims, 1_000)
  assert.ok(token)
  assert.deepEqual(await verifyAdminSessionToken(token, 2_000), { ...claims, exp: 1_000 + SESSION_MS })
})

test('expired, tampered and foreign tokens are rejected', async () => {
  const token = (await createAdminSessionToken(claims, 1_000))!
  assert.equal(await verifyAdminSessionToken(token, 1_000 + SESSION_MS + 1), null)

  const [payload, sig] = token.split('.')
  const forged = Buffer.from(JSON.stringify({ ...claims, role: 'owner', exp: 9e15 })).toString('base64url')
  assert.equal(await verifyAdminSessionToken(`${forged}.${sig}`, 2_000), null)
  assert.equal(await verifyAdminSessionToken(`${payload}.${sig}x`, 2_000), null)
  assert.equal(await verifyAdminSessionToken(`${payload}.${sig}.extra`, 2_000), null)

  process.env.ADMIN_SESSION_SECRET = 'another-secret'
  assert.equal(await verifyAdminSessionToken(token, 2_000), null)
  process.env.ADMIN_SESSION_SECRET = 'test-secret-for-admin-session'
})

test('pre-M3 shared-password tokens (a bare timestamp) no longer verify', async () => {
  const { createHmac } = await import('node:crypto')
  const legacyPayload = String(Date.now() + 60_000)
  const legacySig = createHmac('sha256', 'test-secret-for-admin-session').update(legacyPayload).digest('base64url')
  assert.equal(await verifyAdminSessionToken(`${legacyPayload}.${legacySig}`), null)
})

test('no secret means no sessions', async () => {
  delete process.env.ADMIN_SESSION_SECRET
  assert.equal(await createAdminSessionToken(claims), null)
  process.env.ADMIN_SESSION_SECRET = 'test-secret-for-admin-session'
})

test('unknown roles are rejected even when signed', async () => {
  const token = await createAdminSessionToken({ ...claims, role: 'superadmin' as never }, 1_000)
  assert.equal(await verifyAdminSessionToken(token, 2_000), null)
})
