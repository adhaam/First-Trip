import assert from 'node:assert/strict'
import test from 'node:test'
import { hashStaffPassword, validateNewPassword, verifyStaffPassword } from './staff-password'

test('hashes verify only with the right password and never contain it', async () => {
  const hash = await hashStaffPassword('correct horse battery')
  assert.match(hash, /^scrypt\$16384\$8\$1\$[\w-]+\$[\w-]+$/)
  assert.ok(!hash.includes('correct horse'))
  assert.equal(await verifyStaffPassword('correct horse battery', hash), true)
  assert.equal(await verifyStaffPassword('correct horse batterY', hash), false)
})

test('the same password hashes differently each time (salted)', async () => {
  assert.notEqual(await hashStaffPassword('same password 1'), await hashStaffPassword('same password 1'))
})

test('malformed or hostile stored hashes fail closed', async () => {
  assert.equal(await verifyStaffPassword('x', 'plaintext'), false)
  assert.equal(await verifyStaffPassword('x', 'scrypt$99999999$8$1$abc$def'), false)
  assert.equal(await verifyStaffPassword('x', 'bcrypt$1$2$3$4$5'), false)
})

test('new passwords need a minimum length', () => {
  assert.ok(validateNewPassword('short'))
  assert.equal(validateNewPassword('long enough pass'), null)
})
