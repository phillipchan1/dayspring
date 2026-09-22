import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { APP_STORE_WHAT_YOU_GET, appStoreWhatYouGetSentence } from '@/lib/storeCopy'

/**
 * Guideline 3.1.2(c), 2026-09-17: App Review rejected build 1.0.767.767 because
 * "the app markets a free trial, but the submitted subscriptions have no free
 * trial". Dayspring's 14 days are granted by the app itself, in our database,
 * with no card and no StoreKit transaction — so on the App Store they are not a
 * trial *of the subscription*, and must not be described as one.
 *
 * Guideline 3.1.2(c), 2026-09-21: build 1.0.930 was rejected again, this time
 * because "complimentary access" does not say what the user receives for the
 * price. Guideline 4.0 was not cited. The App Store branch must name the
 * journal and reflections, and must not say complimentary.
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

/** Empty synonym Apple rejected on 2026-09-21 — does not name the product. */
const COMPLIMENTARY = /complimentary/i

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
  'src/lib/storeCopy.ts',
]

function stripComments(source: string): string {
  // Comments are where we explain *why* a claim is gated, so they have to stay
  // free to say "free trial" or "complimentary" or the reasoning becomes
  // unwritable. Blanked in place — including JSX {/* … */} blocks, which span
  // lines — so the line numbers in a failure still point at the real thing.
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
}

/** True-branch string literals of `gate ? 'App Store' : 'web'`. */
function appStoreBranches(code: string): string[] {
  const re =
    /(?:usesAppStoreCopy\(\)|appStoreWords)\s*\?\s*(`(?:\\[\s\S]|[^`\\])*`|'(?:\\[\s\S]|[^'\\])*'|"(?:\\[\s\S]|[^"\\])*")/g
  // Capture groups are `string | undefined` under noUncheckedIndexedAccess.
  return [...code.matchAll(re)]
    .map((match) => match[1])
    .filter((branch): branch is string => typeof branch === 'string')
}

describe('App Store copy', () => {
  it.each(SURFACES)('%s gates every free-trial claim behind the platform check', (file) => {
    const source = read(file)
    const lines = source.split('\n')
    const code = stripComments(source).split('\n')
    const ungated: string[] = []

    code.forEach((line, i) => {
      if (!CLAIMS.some((c) => c.test(line))) return
      // The gate is usually a few lines up (a ternary, or a const above the JSX).
      const window = code.slice(Math.max(0, i - 12), i + 3).join('\n')
      if (!GATE.test(window)) ungated.push(`${file}:${i + 1}  ${(lines[i] ?? line).trim()}`)
    })

    expect(ungated, `ungated free-trial claim:\n${ungated.join('\n')}`).toEqual([])
  })

  it.each(SURFACES)('%s App Store branch never says complimentary or free-trial', (file) => {
    const source = read(file)
    const code = stripComments(source)
    const forbidden = [...CLAIMS, COMPLIMENTARY]
    const hits: string[] = []

    // The word itself must not ship as user-visible copy on these surfaces.
    // Comments are already blanked. A leftover string is a regression.
    if (COMPLIMENTARY.test(code)) {
      code.split('\n').forEach((line, i) => {
        if (COMPLIMENTARY.test(line)) hits.push(`${file}:${i + 1}  ${line.trim()}`)
      })
    }

    for (const branch of appStoreBranches(code)) {
      for (const claim of forbidden) {
        if (claim.test(branch)) hits.push(`${file}  App Store branch: ${branch}`)
      }
    }

    expect(hits, `App Store-gated copy still claims a trial or says complimentary:\n${hits.join('\n')}`).toEqual([])
  })

  it('shared App Store value copy names the product and forbids trial claims', () => {
    expect(APP_STORE_WHAT_YOU_GET).toMatch(/journal/i)
    expect(APP_STORE_WHAT_YOU_GET).toMatch(/Ascent/)
    expect(APP_STORE_WHAT_YOU_GET).toMatch(/Altar/)
    expect(APP_STORE_WHAT_YOU_GET).toMatch(/Lamp/)
    for (const text of [APP_STORE_WHAT_YOU_GET, appStoreWhatYouGetSentence()]) {
      expect(text).not.toMatch(COMPLIMENTARY)
      for (const claim of CLAIMS) expect(text).not.toMatch(claim)
    }
  })

  it('the App Store listing claims no introductory offer', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    // User-facing storefront fields must not market a trial. Review notes may
    // name the guideline in the negative ("do not market a free trial") so they
    // are checked only for complimentary — the word this rejection cited.
    for (const field of ['promotionalText', 'description', 'subtitle'] as const) {
      for (const claim of CLAIMS) {
        expect(listing[field], `listing.${field} still markets a trial`).not.toMatch(claim)
      }
      expect(listing[field], `listing.${field} still says complimentary`).not.toMatch(COMPLIMENTARY)
    }
    expect(listing.reviewNotes, 'listing.reviewNotes still says complimentary').not.toMatch(
      COMPLIMENTARY,
    )
  })

  it('the listing says plainly that the subscription bills immediately', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    expect(listing.description).toMatch(/no introductory offer/i)
    expect(listing.description).toMatch(/charged to your Apple Account at confirmation/i)
  })
})
