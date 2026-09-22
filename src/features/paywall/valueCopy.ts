/**
 * What the subscription actually buys, in one place.
 *
 * App Review rejected build 1.0.930.930 under Guideline 3.1.2(c) because the
 * purchase surfaces "did not clearly describe what the user will receive for
 * the price". #123 removed the phrase they quoted ("complimentary access") and
 * said "full access to Dayspring" instead — true, but still a label rather than
 * a description. A reviewer reading it learns the name of the thing, not what
 * is in it.
 *
 * So the features are named, and they are named the same way everywhere. The
 * risk with per-surface copy is drift: the banner ends up vaguer than Settings,
 * a reviewer lands on the vague one, and the difference between passing and
 * bouncing is which screen they opened first. One source, four surfaces.
 *
 * Nothing here is App Store-specific — these are the app's features, and they
 * are as true on the web. What differs by platform is the wording around the
 * 14 days (see lib/storeCopy.ts), never this list.
 */

/** The named surfaces, in the order the App Store listing introduces them. */
export const FEATURES = ['writing', 'the Ascent', 'the Altar', 'the Lamp', 'the Rituals'] as const

/** Where a subscription works. Kept short — it rides at the end of a sentence. */
export const PLATFORMS = 'iPhone, Mac, and the web'

/**
 * "writing, the Ascent, the Altar, the Lamp, and the Rituals"
 *
 * Built rather than written out so a change to FEATURES cannot leave one
 * surface listing four of them and another five.
 */
export const FEATURE_LIST = `${FEATURES.slice(0, -1).join(', ')}, and ${FEATURES[FEATURES.length - 1]}`

/**
 * The full sentence, for surfaces with room for one: Settings Plans, the
 * locked screen body, the paywall.
 */
export const FULL_ACCESS_SENTENCE = `Full access to Dayspring — ${FEATURE_LIST}, on ${PLATFORMS}.`

/**
 * The same substance without the leading label, for the trial banner's second
 * line, where "full access" has already been said on the line above and the
 * strip has room for one short sentence and no more.
 */
export const FEATURE_LINE = `${FEATURE_LIST.charAt(0).toUpperCase()}${FEATURE_LIST.slice(1)}.`
