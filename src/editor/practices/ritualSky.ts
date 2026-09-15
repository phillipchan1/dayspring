import type { PracticeRhythm } from './practicesData'

/**
 * THE RITUAL SKY — what hour it is, and what that does to the library.
 *
 * PURE. No React, no DOM, no `new Date()` of its own — the caller passes the
 * clock in. That is what makes the four bands unit-testable and what lets the
 * App Store screenshot surfaces pin an hour instead of shipping whatever time
 * the capture ran at.
 *
 * ── The sky is composed, never swapped ────────────────────────────────────
 *
 * The app has had a sky since the themes were written. Every theme in
 * `src/styles/themes.css` defines `--journal-glow` — a light source parked at
 * `50% -30%`, just above the top edge of the page — and the journal canvas, the
 * Altar, Scripture and the Paywall all render it. It has simply never moved.
 *
 * So none of this is new art. The hour gives that existing light a POSITION and
 * a WARMTH: one extra radial gradient laid OVER the theme's own glow, never in
 * place of it.
 *
 * That is not a stylistic preference, it is a constraint. The themes are already
 * named for the hours — `dawn`, `compline`, `vigil`, `sabbath`, `nocturne` — and
 * somebody running `nocturne` chose pure black on purpose. Replacing their
 * theme with a bright sunrise at 7am overrules them inside their own journal,
 * and `PracticeLibrary.css` opens by promising the opposite: every token maps to
 * the theme layer "so the library reads correctly under every Dayspring theme."
 *
 * Composing keeps that promise and is the better image anyway: a `nocturne`
 * morning is first amber at a black horizon.
 *
 * ── What the greeting may say ─────────────────────────────────────────────
 *
 * "Good morning" is a fact about the CLOCK. "You usually write in the mornings"
 * would be a claim about the writer's devotional habits — which is the streak
 * this product has already refused (Principle 2: never gamify). The line lands
 * in the existing `.practice-library__because` slot, whose comment already draws
 * exactly this line: "never a claim about the writer — only about where they
 * opened this from." The clock is the same kind of fact.
 *
 * ⚠️ NEVER INFER FROM AN UNUSUAL HOUR. A 3am sky is fine. A 3am *lament
 * suggestion* is the app diagnosing someone at their worst, and crisis content
 * has no handling yet (D-007, open). Bands map to hours and to nothing else —
 * not to what was written, not to how long since the last entry.
 */

/** The four bands, named for the canonical hours the themes are named for. */
export type SkyBand = 'dawn' | 'midday' | 'evening' | 'night'

/**
 * The CSS custom properties the hour layer reads. Applied to one absolutely
 * positioned div behind the library; see `.practice-sky__hour`.
 */
export interface SkyTokens {
  /** Where the light sits, as a `background-position` pair. */
  '--sky-pos': string
  /** How much of the frame it fills. */
  '--sky-size': string
  /** The colour at the light's centre. */
  '--sky-near': string
  /** Where it falls off to before transparent. */
  '--sky-far': string
}

export interface Sky {
  band: SkyBand
  tokens: SkyTokens
  /** Fact about the clock. Never a claim about the writer — see the header. */
  greeting: string
  /** Why the shelf opens where it does, in the existing because-line slot. */
  because: string
  /** Which rhythm the library opens on at this hour. */
  filter: Extract<PracticeRhythm, 'morning' | 'midday' | 'evening'>
  /** A still star field, over dark themes only. Nothing twinkles. */
  stars: boolean
}

export const SKIES: Record<SkyBand, Sky> = {
  dawn: {
    band: 'dawn',
    tokens: {
      '--sky-pos': '18% 6%',
      '--sky-size': '95% 78%',
      '--sky-near': 'rgba(236, 158, 74, 0.30)',
      '--sky-far': 'rgba(206, 108, 72, 0.10)',
    },
    greeting: 'Good morning',
    because: 'It’s early — the rituals to begin the day come first.',
    filter: 'morning',
    stars: false,
  },
  midday: {
    band: 'midday',
    tokens: {
      // Where the theme's own glow already is. Midday is the hour the app has
      // been drawing all along.
      '--sky-pos': '50% -34%',
      '--sky-size': '80% 62%',
      '--sky-near': 'rgba(255, 241, 214, 0.26)',
      '--sky-far': 'rgba(226, 214, 190, 0.06)',
    },
    greeting: 'Midday',
    because: 'The day is underway — these are the ones for pausing inside it.',
    filter: 'midday',
    stars: false,
  },
  evening: {
    band: 'evening',
    tokens: {
      '--sky-pos': '84% 10%',
      '--sky-size': '98% 80%',
      '--sky-near': 'rgba(206, 96, 70, 0.28)',
      '--sky-far': 'rgba(122, 74, 122, 0.12)',
    },
    greeting: 'Good evening',
    because: 'The light is going — these are the ones for closing the day.',
    filter: 'evening',
    stars: false,
  },
  night: {
    band: 'night',
    tokens: {
      // The overhead light is gone; what is left washes up from the lower edge.
      '--sky-pos': '50% 118%',
      '--sky-size': '120% 70%',
      '--sky-near': 'rgba(78, 84, 140, 0.22)',
      '--sky-far': 'rgba(40, 44, 82, 0.10)',
    },
    greeting: 'It’s late',
    // Deliberately permissive. Nobody awake at 1am needs the app to have an
    // opinion about it, and "you haven't written today" is exactly the guilt
    // Principle 2 forbids.
    because: 'The closing rituals are here, if you want them.',
    filter: 'evening',
    stars: true,
  },
}

/**
 * Which band an hour falls in. Hours only — see the warning in the header.
 *
 * Night wraps midnight, which is why it is the fallthrough rather than a range.
 */
export function bandForHour(hour: number): SkyBand {
  if (hour >= 4 && hour <= 10) return 'dawn'
  if (hour >= 11 && hour <= 16) return 'midday'
  if (hour >= 17 && hour <= 21) return 'evening'
  return 'night'
}

/** The sky for a given moment. Local time — the writer's morning, not UTC's. */
export function skyFor(now: Date): Sky {
  return SKIES[bandForHour(now.getHours())]
}
