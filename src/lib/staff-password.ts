// Server only: node:crypto keeps this out of client bundles.
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'

// Staff passwords are stored only as scrypt hashes (migration 035 requires the
// `scrypt$` prefix). Format: scrypt$N$r$p$<salt b64url>$<hash b64url>.
const N = 16384
const R = 8
const P = 1
const KEY_LENGTH = 64

export const MIN_PASSWORD_LENGTH = 10

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, KEY_LENGTH, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashStaffPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(password, salt, N, R, P)
  return ['scrypt', N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$')
}

export async function verifyStaffPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [n, r, p] = parts.slice(1, 4).map(Number)
  if (![n, r, p].every(Number.isInteger) || n > 1 << 20) return false
  const expected = Buffer.from(parts[5], 'base64url')
  const actual = await scrypt(password, Buffer.from(parts[4], 'base64url'), n, r, p)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

// Verifying against this keeps a login for an unknown email as slow as one
// for a known email, so response time does not reveal who has an account.
let dummyHash: Promise<string> | null = null
export function dummyStaffHash(): Promise<string> {
  dummyHash ??= hashStaffPassword(randomBytes(12).toString('hex'))
  return dummyHash
}

export function validateNewPassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  if (password.length > 200) return 'Password is too long'
  return null
}
