#!/usr/bin/env node
// Prove an App Store Connect API key can actually see this app, before a build
// spends eight minutes finding out it can't.
//
// A bad key fails at `xcodebuild exportArchive` — the LAST step of the iOS
// release, after the Rust compile and the archive — and the message it gives
// there ("No profiles for 'com.phillipchan.dayspring' were found") describes a
// symptom, not the cause. This does the same auth in one HTTPS call and says
// what's actually wrong.
//
// The failure this exists to catch: App Store Connect issues TWO kinds of key
// under Users and Access → Integrations, on two different tabs, with two
// DIFFERENT issuer ids. The **In-App Purchase** key (what api/apple/verify and
// scripts/asc-setup-iap.mjs use) cannot sign builds or read /v1/apps. The
// **App Store Connect API** key, role Admin or App Manager, is the one CI needs.
// Both produce a perfectly well-formed JWT, so the only thing that tells them
// apart is Apple answering 401.
//
// In CI: reads APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_PATH.
// Locally:
//   node scripts/asc-auth-check.mjs \
//     --key-id XXXXXXXXXX --issuer-id YYYY-... --key-path ~/Downloads/AuthKey_XXXXXXXXXX.p8

import { readFileSync } from 'node:fs'
import { createSign, createPrivateKey } from 'node:crypto'
import process from 'node:process'

function arg(name, envName) {
  const i = process.argv.indexOf(`--${name}`)
  if (i !== -1) return process.argv[i + 1]
  return envName ? process.env[envName] : undefined
}

const keyId = arg('key-id', 'APPLE_API_KEY')
const issuerId = arg('issuer-id', 'APPLE_API_ISSUER')
const keyPath = arg('key-path', 'APPLE_API_KEY_PATH')
const bundleId = arg('bundle-id') || 'com.phillipchan.dayspring'

function die(lines) {
  for (const line of lines) console.error(line)
  process.exit(1)
}

if (!keyId || !issuerId || !keyPath) {
  die([
    'asc-auth-check: missing credentials.',
    '  Pass --key-id / --issuer-id / --key-path, or set',
    '  APPLE_API_KEY / APPLE_API_ISSUER / APPLE_API_KEY_PATH.',
  ])
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

let token
try {
  const privateKey = createPrivateKey(readFileSync(keyPath, 'utf8'))
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const now = Math.floor(Date.now() / 1000)
  const payload = base64url(
    JSON.stringify({ iss: issuerId, iat: now, exp: now + 600, aud: 'appstoreconnect-v1' }),
  )
  const signingInput = `${header}.${payload}`
  // App Store Connect wants raw IEEE-P1363 (r||s) ES256 signatures, not DER.
  const signature = createSign('SHA256')
    .update(signingInput)
    .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  token = `${signingInput}.${base64url(signature)}`
} catch (err) {
  die([
    `asc-auth-check: could not sign a token with ${keyPath}`,
    `  ${err.message}`,
    '',
    '  The file must be the raw .p8 PEM ("-----BEGIN PRIVATE KEY-----").',
    '  In CI the secret holds its BASE64; the workflow decodes it before this runs,',
    '  so a failure here usually means the secret was stored un-encoded.',
  ])
}

const res = await fetch(
  `https://api.appstoreconnect.apple.com/v1/apps?filter[bundleId]=${encodeURIComponent(bundleId)}&limit=1`,
  { headers: { authorization: `Bearer ${token}` } },
)

if (res.status === 401) {
  die([
    'asc-auth-check: App Store Connect rejected the key (401 NOT_AUTHORIZED).',
    '',
    '  The token signed fine, so the .p8 itself is readable — Apple just does not',
    '  accept this key/issuer pair. Almost always one of:',
    '',
    '  1. It is an IN-APP PURCHASE key, not an App Store Connect API key.',
    '     Those are different tabs under Users and Access → Integrations, and they',
    '     have DIFFERENT issuer ids. The IAP key (APPLE_KEY_ID / APPLE_ISSUER_ID in',
    '     Vercel, used by api/apple/verify) cannot sign builds or read /v1/apps.',
    '     CI needs the "App Store Connect API" tab, role Admin or App Manager.',
    '',
    '  2. The Key ID and Issuer ID come from different keys, or the Issuer ID was',
    '     copied from the wrong tab. The issuer sits above the key table on each tab.',
    '',
    '  3. The key was revoked.',
    '',
    '  See docs/IOS.md § Automated TestFlight builds.',
  ])
}

if (!res.ok) {
  die([`asc-auth-check: ${res.status} ${res.statusText}`, `  ${await res.text()}`])
}

const body = await res.json()
const app = body.data?.[0]
if (!app) {
  die([
    `asc-auth-check: the key authenticated, but sees no app with bundle id ${bundleId}.`,
    '',
    '  The key is valid; it just lacks access to this app. Check its role is Admin or',
    '  App Manager (a Developer-role key authenticates but cannot ship), and that the',
    '  app record exists under this Apple Developer account.',
  ])
}

console.log(
  `asc-auth-check: ok — key ${keyId} can see "${app.attributes?.name ?? bundleId}" (${bundleId}, id ${app.id})`,
)
