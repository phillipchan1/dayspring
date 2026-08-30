// A subject and a marking, in the same place on the same page.
//
// ── Why this is its own module ───────────────────────────────────────────────
//
// `features/pages/nearby.ts` already answers this question and answers it well,
// but it can only answer it for Pages: it takes loaded `Entry` objects, it runs
// in a component's `useMemo`, and it recovers a marking's position by searching
// the marking's own sentence back into the prose. That last part is what limits
// it — a needle under twelve characters is unlocatable, and a DECLARED block is
// excluded outright, because its fence is stripped before the search runs. So
// the one feature built to find what you marked beside a subject cannot see a
// single `/pray` the writer typed.
//
// With `spiritual_items.char_start` (migration 20260829120000) the position is
// stored rather than re-derived, and the join becomes arithmetic that anything
// can run — the Lamp, a background job, the bench.
//
// ── The rule that does not change ───────────────────────────────────────────
//
// Distance is the FILTER and never the SORT. Ordering by closeness would be the
// app deciding which of someone's verses matter most about a person, and
// significance is a verdict (D-016). Callers order by when it was written.

import type { SpiritualItemType } from './types'

/**
 * How far a marking may sit from a mention and still count as near it.
 *
 * Lines, not characters, and few of them. A journal paragraph is a thought; the
 * verse belonging to a thought is in it or beside it. Widen this and "near"
 * quietly becomes "on the same page", which is the thing that did not work.
 * Kept identical to `features/pages/nearby.ts` so the two never disagree.
 */
export const NEAR_LINES = 3

/**
 * The shortest sentence worth searching for when a marking has no stored
 * offset. Below it a "quote" is a phrase that appears in half the entries
 * someone ever wrote, and a marking placed at random is worse than none.
 */
const MIN_LOCATABLE = 12

export interface LocatableMarking {
  id: string
  type: SpiritualItemType
  content: string
  /** Offset into `body_markdown` as stored, or null when never located. */
  charStart: number | null
}

export interface NearHit {
  id: string
  type: SpiritualItemType
  /** Lines between the nearest mention and the marking. 0 is the same line. */
  distance: number
}

/**
 * Line index containing `offset`, counting newlines before it.
 *
 * A NULL offset must never reach here. Coalescing it to 0 would put every
 * unlocated marking on line one, next to whatever the writer opened with.
 */
export function lineAt(body: string, offset: number): number {
  let line = 0
  const stop = Math.min(offset, body.length)
  for (let i = 0; i < stop; i++) if (body.charCodeAt(i) === 10) line++
  return line
}

/** Line indices where the subject is named. */
export function mentionLines(body: string, match: RegExp): number[] {
  const out: number[] = []
  const rx = new RegExp(match.source, match.flags.includes('g') ? match.flags : match.flags + 'g')
  rx.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = rx.exec(body)) !== null) {
    out.push(lineAt(body, m.index))
    if (m.index === rx.lastIndex) rx.lastIndex++
  }
  return [...new Set(out)]
}

/**
 * Where a marking sits, preferring the stored offset and falling back to the
 * verbatim search while the backfill is still running. Returns -1 when the
 * marking cannot honestly be placed — a harvested sentence the writer has since
 * edited has no position, and inventing one asserts a connection nobody made.
 */
function locate(body: string, marking: LocatableMarking): number {
  if (marking.charStart != null) return lineAt(body, marking.charStart)
  const needle = marking.content.trim()
  if (needle.length < MIN_LOCATABLE) return -1
  const at = body.indexOf(needle)
  return at === -1 ? -1 : lineAt(body, at)
}

/**
 * Every marking on this page sitting within `within` lines of a mention.
 *
 * Order is the order they appear in the page, which is the order they were
 * written — the only order here that is not a claim about which of them matters.
 */
export function markingsNearSubject(
  body: string,
  match: RegExp,
  markings: readonly LocatableMarking[],
  within = NEAR_LINES,
): NearHit[] {
  if (!body || markings.length === 0) return []
  const mentions = mentionLines(body, match)
  if (mentions.length === 0) return []

  const out: NearHit[] = []
  for (const marking of markings) {
    const at = locate(body, marking)
    if (at < 0) continue
    let nearest = Number.POSITIVE_INFINITY
    for (const m of mentions) nearest = Math.min(nearest, Math.abs(m - at))
    if (nearest <= within) out.push({ id: marking.id, type: marking.type, distance: nearest })
  }
  return out
}

/** "on the same line", "two lines away" — a fact, never a score. */
export function distanceText(distance: number): string {
  if (distance === 0) return 'on the same line'
  if (distance === 1) return 'the next line'
  return `${distance} lines away`
}
