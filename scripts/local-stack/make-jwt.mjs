#!/usr/bin/env node
// LOCAL DOCKER STACK ONLY — generates an HS256 JWT for the local PostgREST
// instance. Never used against production; the signing secret is a fixed
// local-only string passed in via PGRST_JWT_SECRET / --secret.
//
// Usage:
//   node make-jwt.mjs --role service_role --secret "<32+ char secret>"
//   node make-jwt.mjs --role anon --secret "<32+ char secret>"
//
// Prints the JWT (and nothing else) to stdout.

import { createHmac } from 'node:crypto'

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function parseArgs(argv) {
  const args = { role: 'service_role', secret: '' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--role') args.role = argv[++i]
    else if (argv[i] === '--secret') args.secret = argv[++i]
  }
  return args
}

const { role, secret } = parseArgs(process.argv.slice(2))

if (!secret || secret.length < 32) {
  console.error('make-jwt.mjs: --secret must be at least 32 characters (local-only signing secret)')
  process.exit(1)
}

const header = { alg: 'HS256', typ: 'JWT' }
const nowSeconds = Math.floor(Date.now() / 1000)
const payload = {
  role,
  iss: 'supabase-local',
  iat: nowSeconds,
  // Far future expiry — this is a disposable local dev stack, never production.
  exp: nowSeconds + 60 * 60 * 24 * 365 * 10,
}

const encodedHeader = base64url(JSON.stringify(header))
const encodedPayload = base64url(JSON.stringify(payload))
const signingInput = `${encodedHeader}.${encodedPayload}`
const signature = createHmac('sha256', secret).update(signingInput).digest('base64')
  .replace(/=/g, '')
  .replace(/\+/g, '-')
  .replace(/\//g, '_')

console.log(`${signingInput}.${signature}`)
