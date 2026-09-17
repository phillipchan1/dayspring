import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Guideline 3.1.2(c), 2026-09-17: App Review rejected build 1.0.767.767 because
 * "the app markets a free trial, but the submitted subscriptions have no free
 * trial". Dayspring's 14 days are granted by the app itself, in our database,
 * with no card and no StoreKit transaction — so on the App Store they are not a
 * trial *of the subscription*, and must not be described as one.
 *
 * These are tripwires, not proofs. They cannot tell whether a string renders,
 * only whether someone reintroduced the claim somewhere it would. That is worth
 * having: the copy drifted back in once already, across five separate files,
 * and the cost of finding out was a rejected submission and a week.
 */

const ROOT = resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(resolve(ROOT, p), 'utf8')

/** Phrases that describe an App Store introductory offer we do not sell. */
const CLAIMS = [/free trial/i, /\d+ days free/i, /\d+-day free/i, /no charge today/i]

/** Anything that proves the line sits on a platform-gated branch. */
const GATE = /usesAppStoreCopy|appStoreWords|useApple|IS_APP_STORE_RELEASE|isAppleIapAvailable/

/** Files that render on a surface an App Store build can reach. */
const SURFACES = [
  'src/features/paywall/PaywallScreen.tsx',
  'src/features/paywall/LockedScreen.tsx',
  'src/features/paywall/TrialBanner.tsx',
  'src/features/paywall/TrialWelcome.tsx',
  'src/features/paywall/AppleSubscriptionTerms.tsx',
  'src/features/settings/SettingsPanel.tsx',
]

describe('App Store copy', () => {
  it.each(SURFACES)('%s gates every free-trial claim behind the platform check', (file) => {
    const source = read(file)
    const lines = source.split('\n')
    // Comments are where we explain *why* a claim is gated, so they have to stay
    // free to say "free trial" or the reasoning becomes unwritable. Blanked in
    // place — including JSX {/* … */} blocks, which span lines — so the line
    // numbers in a failure still point at the real thing.
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
      .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
      .split('\n')
    const ungated: string[] = []

    code.forEach((line, i) => {
      if (!CLAIMS.some((c) => c.test(line))) return
      // The gate is usually a few lines up (a ternary, or a const above the JSX).
      const window = code.slice(Math.max(0, i - 12), i + 3).join('\n')
      if (!GATE.test(window)) ungated.push(`${file}:${i + 1}  ${(lines[i] ?? line).trim()}`)
    })

    expect(ungated, `ungated free-trial claim:\n${ungated.join('\n')}`).toEqual([])
  })

  it('the App Store listing claims no introductory offer', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    for (const field of ['promotionalText', 'description', 'subtitle'] as const) {
      for (const claim of CLAIMS) {
        expect(listing[field], `listing.${field} still markets a trial`).not.toMatch(claim)
      }
    }
  })

  it('the listing says plainly that the subscription bills immediately', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    expect(listing.description).toMatch(/no introductory offer/i)
    expect(listing.description).toMatch(/charged to your Apple Account at confirmation/i)
  })
})
