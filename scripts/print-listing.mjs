#!/usr/bin/env node
/**
 * Render assets/appstore/listing.json as a copy-paste sheet for App Store Connect.
 *
 *   npm run listing:paste              # write assets/appstore/listing-paste.md
 *   npm run listing:paste -- description   # copy one field to clipboard (macOS)
 *
 * App Store Connect has no JSON import for listing copy — paste field by field.
 */

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const JSON_PATH = path.join(ROOT, 'assets/appstore/listing.json')
const OUT_PATH = path.join(ROOT, 'assets/appstore/listing-paste.md')

/** @param {string | undefined} s */
function block(s) {
  return (s ?? '').trim() || '_(leave blank)_'
}

/** @param {Record<string, string>} listing */
function render(listing) {
  const lines = [
    '# App Store Connect — paste sheet',
    '',
    '_Generated from `listing.json`. Edit that file, then run `npm run listing:paste`._',
    '',
    'App Store Connect has **no JSON upload** for listing text — open this file beside ASC and copy each block into the matching field.',
    '',
    '---',
    '',
    '## App Information',
    '',
    '_ASC: **Apps → Dayspring Journal → General → App Information**_',
    '',
    '### Name',
    '',
    '> Already set to **Dayspring Journal** (plain “Dayspring” is taken on the App Store). Home screen still shows **Dayspring**.',
    '',
    '### Subtitle _(30 chars max)_',
    '',
    block(listing.subtitle),
    '',
    '### Privacy Policy URL',
    '',
    block(listing.privacyPolicyUrl),
    '',
    '### Primary category',
    '',
    block(listing.categoryPrimary),
    '',
    '### Secondary category _(optional)_',
    '',
    block(listing.categorySecondary) === '_(leave blank)_' ? '_(none)_' : block(listing.categorySecondary),
    '',
    '---',
    '',
    '## iOS App Version (English U.S.)',
    '',
    '_ASC: **Distribution → App Store → iOS App** (your version, e.g. 1.0)_',
    '',
    '### Promotional Text _(170 chars, optional — can change without new build)_',
    '',
    block(listing.promotionalText),
    '',
    '### Description',
    '',
    block(listing.description),
    '',
    '### Keywords _(100 chars, comma-separated, no spaces after commas)_',
    '',
    block(listing.keywords),
    '',
    '### Support URL',
    '',
    block(listing.supportUrl),
    '',
    '### Marketing URL _(optional)_',
    '',
    block(listing.marketingUrl),
    '',
    '### Copyright',
    '',
    block(listing.copyright),
    '',
    '---',
    '',
    '## App Review Information',
    '',
    '_ASC: same version page, scroll to **App Review Information**_',
    '',
    '### Notes',
    '',
    block(listing.reviewNotes),
    '',
    '### Contact',
    '',
    'phillipchan1@gmail.com',
    '',
    '---',
    '',
    '## Version release (same page)',
    '',
    '### Export compliance',
    '',
    'When prompted: **No** — app uses only standard HTTPS encryption.',
    '',
    'Info.plist already has `ITSAppUsesNonExemptEncryption = false`.',
    '',
    '---',
    '',
    '## Not in this file (upload separately)',
    '',
    '| Item | Path |',
    '|------|------|',
    '| iPhone 6.9\\" screenshots | `assets/appstore/listing/6.9/*.png` |',
    '| iPhone 6.5\\" screenshots | `assets/appstore/listing/6.5/*.png` |',
    // Required, not optional: the Xcode project sets TARGETED_DEVICE_FAMILY
    // = "1,2", so ASC will not accept a submission with an empty iPad slot.
    '| iPad 13\\" screenshots **(required)** | `assets/appstore/listing/ipad-13/*.png` |',
    '| Build | Attach **1.0.213 (213)** when processing finishes |',
    '| Subscription review screenshot | `assets/appstore/iap-review-screenshot.png` _(already on products)_ |',
    '',
  ]
  return lines.join('\n')
}

/** @type {Record<string, (l: Record<string, string>) => string>} */
const FIELD_GETTERS = {
  subtitle: (l) => l.subtitle,
  promotional: (l) => l.promotionalText,
  promotionalText: (l) => l.promotionalText,
  description: (l) => l.description,
  keywords: (l) => l.keywords,
  support: (l) => l.supportUrl,
  supportUrl: (l) => l.supportUrl,
  marketing: (l) => l.marketingUrl,
  marketingUrl: (l) => l.marketingUrl,
  copyright: (l) => l.copyright,
  review: (l) => l.reviewNotes,
  reviewNotes: (l) => l.reviewNotes,
  privacy: (l) => l.privacyPolicyUrl,
  privacyPolicyUrl: (l) => l.privacyPolicyUrl,
}

const fieldArg = process.argv[2]

const raw = await fs.readFile(JSON_PATH, 'utf8')
/** @type {Record<string, string>} */
const listing = JSON.parse(raw)

if (fieldArg) {
  const getter = FIELD_GETTERS[fieldArg]
  if (!getter) {
    console.error(`Unknown field "${fieldArg}". Try: ${Object.keys(FIELD_GETTERS).join(', ')}`)
    process.exit(1)
  }
  const text = getter(listing) ?? ''
  try {
    execSync('pbcopy', { input: text })
    console.log(`Copied "${fieldArg}" to clipboard (${text.length} chars)`)
  } catch {
    process.stdout.write(text)
  }
} else {
  const md = render(listing)
  await fs.writeFile(OUT_PATH, md)
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)}`)
  console.log('Open it beside App Store Connect and copy each section.')
  console.log('Or: npm run listing:paste -- description   (copies one field)')
}
