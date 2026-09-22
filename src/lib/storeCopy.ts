import { isAppleIapAvailable } from './appleIap'
import { IS_APP_STORE_RELEASE } from './releaseChannel'

/**
 * Whether this surface must speak App Store English about the first 14 days.
 *
 * Dayspring grants a 14-day *reverse* trial: the app opens the door itself, in
 * Supabase, with no card and no store involved. On the web that period genuinely
 * is a free trial of the thing being sold — in card-first mode Stripe Checkout
 * attaches `trial_period_days`, so "14 days free, no charge today" is a promise
 * the purchase keeps.
 *
 * The App Store products carry no introductory offer. Choosing a plan there
 * charges the Apple Account immediately. So calling the reverse trial a "free
 * trial" beside a StoreKit sheet describes an offer the subscription does not
 * have — which is what App Review cited under Guideline 3.1.2(c) on 2026-09-17:
 * "the app markets a free trial, but the submitted subscriptions have no free
 * trial". "Complimentary access" failed the same guideline on 2026-09-21
 * (build 1.0.930): it does not say what the user receives for the price. The
 * fix is to name the thing being sold, not to bolt an introductory offer onto
 * products that are priced to match the web.
 *
 * Both halves matter and neither is redundant:
 *  • IS_APP_STORE_RELEASE is a build-time constant — every iOS binary sets
 *    VITE_RELEASE_CHANNEL=appstore (see .github/workflows/ios-release.yml), so
 *    this is true even before StoreKit has answered, and true in the one binary
 *    a reviewer ever runs.
 *  • isAppleIapAvailable() catches the dev paywall preview, so the review
 *    screenshots captured from a browser say exactly what the device says.
 */
export function usesAppStoreCopy(): boolean {
  return IS_APP_STORE_RELEASE || isAppleIapAvailable()
}

/** What choosing a plan buys — a noun phrase, so a surface can finish the
 *  sentence. Said next to StoreKit prices so the billed amount is never beside
 *  an empty synonym ("complimentary access"). */
export const APP_STORE_WHAT_YOU_GET =
  'ongoing access to your journal and reflections — Ascent, Altar, and Lamp'

export function appStoreWhatYouGetSentence(): string {
  return `${APP_STORE_WHAT_YOU_GET.charAt(0).toUpperCase()}${APP_STORE_WHAT_YOU_GET.slice(1)}.`
}
