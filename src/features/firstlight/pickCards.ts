import { RELEASES, type Card, type Release } from './releases'

/**
 * Hard ceiling on one deck. Three is already at the edge of what someone will
 * read before they came here to write; a release needing more needs fewer
 * claims, not more cards.
 */
export const MAX_CARDS = 3

export interface Deck {
  cards: Card[]
  /** Written to settings.lastSeenRelease when the deck closes, however it closes. */
  seenId: string
  land?: Release['land']
  landLabel?: string
}

/**
 * Decide what — if anything — to show someone.
 *
 * Pure, and called exactly once per cold start (see FirstLight.tsx). Keeping the
 * decision in one pure function is what makes Principle 3 enforceable: a deck
 * that cannot be recomputed cannot appear over a live cursor.
 *
 * `lastSeen` semantics:
 *   - `null`/`undefined` — never seen one. Every major release shows. This is
 *     every existing user on the day First Light ships, which is intended: they
 *     are exactly the people who need to be told the list moved.
 *   - a known id — show the major releases *after* it.
 *   - an id not in the registry — treat as caught up and show nothing. This is
 *     the downgrade case (a newer build stamped an id this one doesn't know).
 *     Showing nothing risks a missed announcement; the alternative re-opens a
 *     deck someone already dismissed, and "dismissing is final" is the promise
 *     that keeps this surface from feeling like nagging.
 *
 * Cards from several unseen majors merge into ONE deck, oldest first, capped —
 * someone who was away for two releases gets a single deck, never two in a row.
 */
export function pickCards(
  lastSeen: string | null | undefined,
  releases: Release[] = RELEASES,
): Deck | null {
  if (releases.length === 0) return null

  let startAt = 0
  if (lastSeen != null && lastSeen !== '') {
    const idx = releases.findIndex((r) => r.id === lastSeen)
    if (idx === -1) return null // unknown id — see note above
    startAt = idx + 1
  }

  const unseenMajors = releases.slice(startAt).filter((r) => r.major)
  const cards = unseenMajors.flatMap((r) => r.cards).slice(0, MAX_CARDS)
  if (cards.length === 0) return null

  // The newest id in the whole registry, not just the majors — closing the deck
  // catches you up completely, so a minor release can never queue behind a major
  // one and surface later on its own.
  const seenId = releases[releases.length - 1]!.id

  // Land on the destination of the most recent major in the deck.
  const landFrom = unseenMajors[unseenMajors.length - 1]!
  return {
    cards,
    seenId,
    ...(landFrom.land ? { land: landFrom.land } : {}),
    ...(landFrom.landLabel ? { landLabel: landFrom.landLabel } : {}),
  }
}

/**
 * The deck for Settings → About, where the question is "what was the last
 * announcement?" rather than "what have I missed?". Newest major release only —
 * re-reading it must never replay a year of history.
 */
export function latestDeck(releases: Release[] = RELEASES): Deck | null {
  const majors = releases.filter((r) => r.major)
  const newest = majors[majors.length - 1]
  if (!newest || releases.length === 0) return null
  return {
    cards: newest.cards.slice(0, MAX_CARDS),
    seenId: releases[releases.length - 1]!.id,
    ...(newest.land ? { land: newest.land } : {}),
    ...(newest.landLabel ? { landLabel: newest.landLabel } : {}),
  }
}
