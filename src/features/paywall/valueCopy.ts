/**
 * What the subscription actually buys, in one place.
 *
 * App Review rejected build 1.0.942.942 under Guideline 3.1.2 because the
 * auto-renewing subscription read as a one-time unlock of named modules
 * (Ascent / Altar / Lamp / Rituals) rather than an ongoing service. Day One
 * keeps ARS by selling sync, backup, and a library that grows — writing itself
 * is free on the device.
 *
 * The words here are service nouns. They must stay the same on every purchase
 * surface (paywall, locked screen, trial banner, Settings → Billing) so a
 * reviewer cannot land on a vaguer screen than the one we meant.
 *
 * Do not name AI, models, or server processing here. Those exist and may be
 * cited in App Review Notes only.
 */

/** Ongoing services the subscription renews. Not a module-unlock list.
 *  These strings must appear (case-insensitive) on every purchase surface —
 *  purchaseSurfaces.test.ts checks that. */
export const FEATURES = ['sync', 'backup', 'expanding rituals library'] as const

/** Where a subscription works. Kept short — it rides at the end of a sentence. */
export const PLATFORMS = 'iPhone, Mac, and the web'

/**
 * "sync across devices, cloud backup, and the expanding rituals library"
 *
 * Built rather than written out so a change to FEATURES cannot leave one
 * surface listing two of them and another three.
 */
export const FEATURE_LIST = `${FEATURES.slice(0, -1).join(', ')}, and ${FEATURES[FEATURES.length - 1]}`

/**
 * The full sentence, for surfaces with room for one: Settings Plans, the
 * locked screen body, the paywall.
 */
export const FULL_ACCESS_SENTENCE = `Sync, backup, and the expanding rituals library — on ${PLATFORMS}.`

/**
 * The same substance without the leading label, for the trial banner's second
 * line, where the strip has room for one short sentence and no more.
 */
export const FEATURE_LINE = `${FEATURE_LIST.charAt(0).toUpperCase()}${FEATURE_LIST.slice(1)}.`

/**
 * Three short bullets for surfaces that can show a list. Same nouns as
 * FEATURES, phrased as services that continue each period.
 */
export const SERVICE_BULLETS = [
  'Sync across iPhone, Mac, and the web',
  'Cloud backup of everything you write',
  'The expanding rituals library — new forms through the year',
] as const

/**
 * App-granted evaluation window, in days. Used by the review-access script and
 * as the cap above which Settings must not print a countdown (a ~359-day
 * "Full access — N days remaining" reads as complimentary lifetime).
 */
export const APP_GRANTED_DAYS = 14
export const APP_GRANTED_DISPLAY_CAP = 21

/** False when a leftover long runway would look like lifetime access. */
export function shouldShowGrantedCountdown(days: number): boolean {
  return days > 0 && days <= APP_GRANTED_DISPLAY_CAP
}
