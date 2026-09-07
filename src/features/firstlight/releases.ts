/**
 * FIRST LIGHT — the release-note registry. Every word any announcement has ever
 * shown lives in this file.
 *
 * Same discipline as features/ads/ads.ts and features/appstore/shots.ts: copy is
 * data, rendered as real text, so editing this file is the whole loop and
 * `?__preview=firstlight` shows the result without signing in.
 *
 * WHAT THIS IS FOR
 *
 * Not "what's new". The job is **orientation**: telling someone what moved under
 * them, on the one occasion they open the app and find it rearranged. Pages
 * replacing the entries list is the case that justifies the surface existing —
 * a user who opens 1.0.x and finds their list gone deserves a sentence about it.
 * Celebration is the register the news is delivered in, never the reason to
 * deliver it.
 *
 * THE GATE IS A HUMAN
 *
 * `major: true` is set by hand, per release, by Phil. There is deliberately no
 * heuristic — not a version bump, not a diff size, not a count of changed
 * surfaces. "Major" means *the user will notice something is different*, and no
 * computed signal knows that. A release without the flag ships silently, and
 * silence is the default.
 *
 * COPY DISCIPLINE (docs/product/BRANDSCRIPT.md + PRINCIPLES.md)
 *
 * Banned: journey, unlock, unleash, supercharge, AI-powered, insights (as a
 * noun-blob), optimize, track, streak, score, mindfulness, wellness, hack.
 * Also banned here specifically: exclamation marks, emoji, confetti, and any
 * sentence about the *user* rather than the app. First Light describes what
 * changed in the software. It never counts what someone has written, never
 * congratulates them, and never sells them anything — they already paid.
 *
 * PRINCIPLE 3 is the constraint that shaped the surface: "modal interruptions
 * while the cursor is active" are forbidden. So the deck is decided once, at
 * cold open, before the editor takes focus — see pickCards.ts — and can never
 * appear mid-session.
 */

/** A small inline glyph above the title. Purely decorative; never load-bearing. */
export type CardArt = 'wall' | 'keys'

export interface Card {
  /** Small caps line above the title. Two or three words. */
  kicker: string
  title: string
  /** One paragraph per string. Two is plenty; three is the ceiling. */
  body: string[]
  art?: CardArt
}

export interface Release {
  /** Stable, sortable, human-readable. Written into settings.lastSeenRelease. */
  id: string
  /**
   * THE ONLY GATE. Hand-set. Omit it and this release never auto-shows —
   * it stays here as history, reachable from Settings → About.
   */
  major?: boolean
  cards: Card[]
  /** Where the final button sends them. Omitted → the button just closes. */
  land?: 'pages'
  /** Label for the final button. Defaults to "Done". */
  landLabel?: string
}

/**
 * Oldest → newest. Order matters: pickCards() walks this array and shows
 * everything after the reader's `lastSeenRelease`.
 */
export const RELEASES: Release[] = [
  {
    id: '2026-09-pages',
    major: true,
    land: 'pages',
    landLabel: 'Open Pages',
    cards: [
      {
        kicker: 'What changed',
        art: 'wall',
        title: 'Your journal, as pages',
        body: [
          'The list of titles is gone. In its place your entries lie side by side — a year at arm’s length, or one page close enough to read.',
          'Looking for the list? This is where it was. Drag the zoom slider until the pages are small and you have the same thing, only you can see the shape of it.',
        ],
      },
      {
        kicker: 'What changed',
        art: 'keys',
        title: 'The rail counts from writing',
        body: [
          'Your journal took a place near the top, so everything below it moved down one. If your fingers know ⌘2 as Ascent, it’s ⌘3 now.',
        ],
      },
      {
        kicker: 'Also new',
        title: 'A palette brings its own hand',
        body: [
          'Choosing a theme used to change colour and nothing else. The typeface was a separate setting, and the two had never been introduced.',
          'Now each one is a voice — its own face, its own tones for your markings, its own ornament — and each holds both light and dark, so nothing shifts when the sun goes down. Six to read in, under Settings → Appearance.',
        ],
      },
    ],
  },
]

/**
 * The id stamped on someone who should see nothing — a brand-new account at the
 * end of onboarding. Newest entry in the registry, major or not.
 *
 * Empty registry returns null, which pickCards() reads as "nothing to show".
 */
export const CURRENT_RELEASE_ID: string | null =
  RELEASES.length > 0 ? RELEASES[RELEASES.length - 1]!.id : null
