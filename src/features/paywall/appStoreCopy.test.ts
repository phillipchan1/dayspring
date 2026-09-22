import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { FEATURES } from './valueCopy'

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

/**
 * Phrases that describe an App Store introductory offer we do not sell.
 *
 * "no charge" is here in its general form rather than as the three literals we
 * happen to ship ("No charge today", "No charge for 14 days", "No charge until
 * then"). A tripwire that lists the exact strings already in the file only
 * catches a copy-paste; the next wording will be a fourth phrasing nobody
 * thought to add. The claim is the promise of not being billed, however it is
 * spelled.
 *
 * These stay GATED rather than banned outright, because off the App Store they
 * are true: Stripe Checkout really does attach trial_period_days, so the web
 * genuinely sells a free trial and D-031 keeps that language. What must never
 * happen is one of them rendering on a surface an App Store build can reach
 * without the platform check above it.
 */
const CLAIMS = [
  /free trial/i,
  /\d+ days free/i,
  /\d+-day free/i,
  /no charge/i,
  /without (being )?charged?/i,
  /no payment method/i,
]

/**
 * Guideline 3.1.2(c), 2026-09-21: build 1.0.930.930 was rejected again, and this
 * time Apple quoted the replacement copy — "complimentary access" — as the
 * problem: the subscription "does not clearly describe what the user will
 * receive for the price". The word priced the first 14 days and never said what
 * they were, so no purchase surface named the thing being bought.
 *
 * Unlike CLAIMS this needs no platform gate to be wrong. D-031 bans the word on
 * the marketing site, and App Review banned it in the app, so there is nowhere
 * left it may render. Comments may still say it — that is where the ban is
 * explained — and the blanking below keeps them free to.
 */
const BANNED_EVERYWHERE = [/complimentary/i]

/** Anything that proves the line sits on a platform-gated branch. */
const GATE = /usesAppStoreCopy|appStoreWords|useApple|IS_APP_STORE_RELEASE|isAppleIapAvailable/

/**
 * The source with every comment blanked in place. Comments are where we explain
 * *why* a claim is gated or a word is banned, so they have to stay free to say
 * "free trial" and "complimentary" or the reasoning becomes unwritable. Blanked
 * rather than stripped — including JSX {/* … *\/} blocks, which span lines — so
 * the line numbers in a failure still point at the real thing.
 */
const blankComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .split('\n')

/** The four surfaces that can start a purchase, and so must describe one. */
const PURCHASE_SURFACES = [
  'src/features/paywall/PaywallScreen.tsx',
  'src/features/paywall/LockedScreen.tsx',
  'src/features/paywall/TrialBanner.tsx',
  'src/features/settings/SettingsPanel.tsx',
]

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
    const code = blankComments(source)
    const ungated: string[] = []

    code.forEach((line, i) => {
      if (!CLAIMS.some((c) => c.test(line))) return
      // The gate is usually a few lines up (a ternary, or a const above the JSX).
      const window = code.slice(Math.max(0, i - 12), i + 3).join('\n')
      if (!GATE.test(window)) ungated.push(`${file}:${i + 1}  ${(lines[i] ?? line).trim()}`)
    })

    expect(ungated, `ungated free-trial claim:\n${ungated.join('\n')}`).toEqual([])
  })

  it.each(SURFACES)('%s never says "complimentary" in rendered copy', (file) => {
    const source = read(file)
    const lines = source.split('\n')
    const code = blankComments(source)
    const found: string[] = []

    code.forEach((line, i) => {
      if (BANNED_EVERYWHERE.some((b) => b.test(line))) {
        found.push(`${file}:${i + 1}  ${(lines[i] ?? line).trim()}`)
      }
    })

    expect(found, `App Review cited this word (3.1.2(c), build 930):\n${found.join('\n')}`)
      .toEqual([])
  })

  it('the review notes describe the 14 days the way the app now does', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    // The notes tell the reviewer what to expect on screen. Leaving the old word
    // here would hand back the exact phrase the last rejection quoted, and would
    // quote a banner string that no longer exists.
    for (const field of ['reviewNotes', 'promotionalText', 'description', 'subtitle'] as const) {
      expect(listing[field], `listing.${field} still says "complimentary"`).not.toMatch(
        /complimentary/i,
      )
    }
    expect(listing.reviewNotes).toMatch(/full access/i)
  })

  it('the App Store listing claims no introductory offer', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    // Unconditional here, unlike the source files: every one of these fields is
    // read on the App Store and nowhere else, so there is no web reading of
    // them under which a no-charge promise would be true.
    for (const field of ['promotionalText', 'description', 'subtitle'] as const) {
      for (const claim of CLAIMS) {
        expect(listing[field], `listing.${field} still markets a trial`).not.toMatch(claim)
      }
    }
  })

  it('the listing describes the 14 days without offering them as a deal', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    // 2026-09-17 was a rejection for marketing an offer the products do not
    // carry. The description has to be able to explain the app-managed period
    // — it is the honest thing to do — without the sales register that made
    // "no card, no subscription, nothing to cancel" read as the offer itself.
    expect(listing.description).not.toMatch(/no card/i)
    expect(listing.description).not.toMatch(/nothing to cancel/i)
    expect(listing.description).toMatch(/not an App Store introductory offer/i)
  })

  it('the listing names what a subscription provides beside its price', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    const description = listing.description ?? ''
    const subscriptionBlock = description.slice(description.indexOf('SUBSCRIPTION'))
    for (const feature of FEATURES) {
      expect(subscriptionBlock, `the price block never names ${feature}`).toMatch(
        new RegExp(feature.replace(/^the /, '(the )?'), 'i'),
      )
    }
  })

  it.each(PURCHASE_SURFACES)('%s names what the subscription provides', (file) => {
    // Via the shared module, not by repeating the sentence: four surfaces each
    // carrying their own wording is how the banner ended up vaguer than
    // Settings, which is what build 930 was rejected over.
    expect(read(file), `${file} does not use valueCopy.ts`).toMatch(
      /from '(\.\/|@\/features\/paywall\/)valueCopy'/,
    )
  })

  it('Settings offers no plan before StoreKit has priced it', () => {
    // The rendered proof for the banner and the locked screen lives in
    // purchaseSurfaces.test.ts. Settings' billing tab needs a Supabase session
    // to render, so this checks the gate at the source instead: the Subscribe
    // button is behind the product's own billed price on iOS.
    const source = read('src/features/settings/SettingsPanel.tsx')
    expect(source, 'Settings Subscribe button is no longer gated on a loaded price').toMatch(
      /onIos \? p\.billed !== null : canStripePurchase/,
    )
  })

  it('the listing says plainly that the subscription bills immediately', () => {
    const listing = JSON.parse(read('assets/appstore/listing.json')) as Record<string, string>
    expect(listing.description).toMatch(/no introductory offer/i)
    expect(listing.description).toMatch(/charged to your Apple Account at confirmation/i)
  })
})
