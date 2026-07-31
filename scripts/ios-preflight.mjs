#!/usr/bin/env node
/**
 * Automated half of the docs/IOS.md pre-upload checklist.
 * Device / Sandbox IAP steps still need a phone — this covers everything
 * we can prove from the repo + production endpoints.
 *
 *   node scripts/ios-preflight.mjs
 */

import { createRequire } from 'node:module'
import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ORIGIN = 'https://dayspring-eosin.vercel.app'

const results = []

function ok(name, detail = '') {
  results.push({ ok: true, name, detail })
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name, detail = '') {
  results.push({ ok: false, name, detail })
  console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
}
function skip(name, detail = '') {
  results.push({ ok: null, name, detail })
  console.log(`  · ${name}${detail ? ` — ${detail}` : ''}`)
}

async function exists(p) {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

async function http(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, ok: res.ok }
}

async function main() {
  console.log('iOS preflight (automated)\n')

  // --- Icons ---
  console.log('Icons')
  const icon1024 = path.join(ROOT, 'src-tauri/icon-1024.png')
  const appIcon = path.join(
    ROOT,
    'src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png',
  )
  if (await exists(icon1024)) {
    const { execFileSync } = await import('node:child_process')
    try {
      const out = execFileSync(
        'python3',
        [
          '-c',
          `from PIL import Image; im=Image.open(${JSON.stringify(icon1024)}); print(im.mode, im.size[0], im.size[1], 'transparency' in im.info)`,
        ],
        { encoding: 'utf8' },
      ).trim()
      const [mode, w, h, hasT] = out.split(' ')
      if (mode === 'RGB' && w === '1024' && h === '1024' && hasT === 'False') {
        ok('icon-1024.png opaque RGB 1024', out)
      } else fail('icon-1024.png must be opaque RGB 1024', out)
    } catch (e) {
      fail('icon-1024.png inspect failed', e.message)
    }
  } else fail('icon-1024.png missing')

  if (await exists(appIcon)) {
    try {
      const out = execSync(
        `python3 -c "from PIL import Image; im=Image.open(${JSON.stringify(appIcon)}); print(im.mode, im.size[0], 'transparency' in im.info)"`,
        { encoding: 'utf8' },
      ).trim()
      if (out.startsWith('RGB 1024 False')) ok('AppIcon-512@2x.png opaque RGB', out)
      else fail('AppIcon-512@2x.png still has alpha or wrong size', out)
    } catch (e) {
      fail('AppIcon inspect failed', e.message)
    }
  } else fail('AppIcon-512@2x.png missing — run tauri icon + flatten-ios-icons.py')

  // --- Product IDs / prices in code ---
  console.log('\nCode')
  const appleIap = await readFile(path.join(ROOT, 'src/lib/appleIap.ts'), 'utf8')
  if (appleIap.includes("'dayspring_monthly'") && appleIap.includes("'dayspring_annual'")) {
    ok('Product IDs dayspring_monthly / dayspring_annual')
  } else fail('Product IDs missing from appleIap.ts')
  if (appleIap.includes("'$7.99'") && appleIap.includes("'$69.99'")) {
    ok('Preview prices $7.99 / $69.99')
  } else fail('Preview prices must be $7.99 / $69.99')

  const flags = await readFile(path.join(ROOT, 'src/features/onboarding/flags.ts'), 'utf8')
  if (flags.includes("=== 'true'")) {
    ok('ONBOARDING_REQUIRE_CARD defaults off (env must be true)')
  }

  const tauri = JSON.parse(await readFile(path.join(ROOT, 'src-tauri/tauri.conf.json'), 'utf8'))
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  if (tauri.version === pkg.version) ok('tauri.conf.json version matches package.json', pkg.version)
  else fail('version drift', `tauri=${tauri.version} package=${pkg.version}`)

  if (tauri.identifier === 'com.phillipchan.dayspring') ok('Bundle ID com.phillipchan.dayspring')
  else fail('Unexpected bundle ID', tauri.identifier)

  const plist = await readFile(path.join(ROOT, 'src-tauri/Info.ios.plist'), 'utf8')
  for (const key of [
    'NSMicrophoneUsageDescription',
    'NSCameraUsageDescription',
    'NSPhotoLibraryUsageDescription',
    'ITSAppUsesNonExemptEncryption',
    'dayspring',
  ]) {
    if (plist.includes(key)) ok(`Info.ios.plist has ${key}`)
    else fail(`Info.ios.plist missing ${key}`)
  }

  // --- Review assets ---
  console.log('\nReview assets')
  const shot = path.join(ROOT, 'assets/appstore/iap-review-screenshot.png')
  if (await exists(shot)) ok('iap-review-screenshot.png present')
  else fail('iap-review-screenshot.png missing — npm run screenshots:appstore')

  // --- Production endpoints ---
  console.log('\nProduction endpoints')
  for (const page of ['terms', 'privacy']) {
    const r = await http('GET', `${ORIGIN}/${page}`)
    if (r.status === 200) ok(`GET /${page}`, String(r.status))
    else fail(`GET /${page}`, String(r.status))
  }
  {
    const r = await http('POST', `${ORIGIN}/api/apple/verify`, {})
    if (r.status === 401) ok('/api/apple/verify rejects unauthenticated', '401')
    else fail('/api/apple/verify unexpected', String(r.status))
  }
  {
    const r = await http('POST', `${ORIGIN}/api/webhooks/apple`, {})
    if (r.status === 400 || r.status === 401) {
      ok('/api/webhooks/apple reachable', String(r.status))
    } else fail('/api/webhooks/apple unexpected', String(r.status))
  }

  // --- Device-only remainder ---
  console.log('\nStill needs a device (Sandbox Apple ID)')
  for (const step of [
    'Sign in with Apple (cold start + return from Safari)',
    'Google sign-in via dayspring:// deep link',
    'Mic / photo permission prompts (no crash)',
    'Sandbox purchase monthly + annual unlock entitlement',
    'Restore purchases after reinstall',
    'Paywall shows StoreKit prices (not hardcoded $7/$64)',
    'Terms + Privacy open in Safari from paywall',
    'No Stripe checkout reachable on iOS',
    'Stripe subscriber on iPhone entitled without paywall',
    'Apple subscriber on web sees manage-in-App-Store',
  ]) {
    skip(step, 'manual')
  }

  const failed = results.filter((r) => r.ok === false)
  const passed = results.filter((r) => r.ok === true)
  console.log(`\n${passed.length} passed, ${failed.length} failed, ${results.filter((r) => r.ok === null).length} manual`)
  if (failed.length) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
