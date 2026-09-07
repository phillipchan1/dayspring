// What you marked, beside the pages that carry a subject.
//
// ── The connection that never existed ───────────────────────────────────────
//
// A subject and a marking were never the same kind of thing. A subject is a
// regex over the prose: it lights particular LINES. A marking was a page-level
// boolean with no words and no position (`listMarkings` fetches neither). So
// lighting "Tiffany" and "Scripture" together could only ever mean "both are
// true somewhere on this page", and there was nothing to show for it — not
// because the connection was hidden, but because none had been computed.
//
// With the markings' own text (`markingsForEntries`) both sides are located in
// the same prose, and the question becomes answerable as arithmetic: which
// marked lines sit near a mention. That is the reading the writer was reaching
// for — not "pages where both appear" but *the scriptures I reached for when I
// was writing about her*.
//
// ── What this is not allowed to be ──────────────────────────────────────────
//
// Not a relevance ranking. Distance is the FILTER and never the SORT: ordering
// by closeness would be the app deciding which of her verses matter most about
// a person, which is selection, and selection is significance, and significance
// is a verdict (D-016). The order is the order she wrote them in.
//
// And no model anywhere near it. Two string searches and a subtraction; every
// line shown is verbatim, from a page she wrote, with a kind she or the journal
// named. Nothing is characterised and nothing is summarised.

import { entryContentLines } from '@/lib/entryLabels'
import type { PageMarking } from '@/lib/spiritual'
import type { Entry } from '@/lib/types'
import { flatten } from './pageMarkings'

/**
 * How far a marking may sit from a mention and still count as near it.
 *
 * Lines, not characters, and a small number of them. A journal paragraph is a
 * thought; the verse that belongs to a thought is in it or beside it. Widen
 * this and "near" quietly becomes "on the same page", which is the thing that
 * did not work.
 */
export const NEAR_LINES = 3

export interface NearMarking {
  entry: Entry
  marking: PageMarking
  /**
   * Lines between the nearest mention and this marking. 0 is the same line.
   *
   * Kept so the surface can SAY it — "the same line", "two lines away" — and
   * never so it can sort by it.
   */
  distance: number
}

/** Line indices where the lit subject is named. */
function mentionLines(lines: string[], match: RegExp): number[] {
  const out: number[] = []
  for (let i = 0; i < lines.length; i++) {
    match.lastIndex = 0
    if (match.test(lines[i]!)) out.push(i)
  }
  return out
}

/** The line a marking's sentence lives on, or -1 when the page doesn't say it. */
function markingLine(lines: string[], flat: string[], marking: PageMarking): number {
  const needle = flatten(marking.content)
  // The same floor `sortMarkings` uses: a six-character needle is in half the
  // paragraphs on the page, and a marking placed at random is worse than none.
  if (needle.length < 12) return -1
  for (let i = 0; i < flat.length; i++) if (flat[i]!.includes(needle)) return i
  void lines
  return -1
}

/**
 * Every marked line sitting within `within` lines of a mention.
 *
 * A DECLARED block is deliberately absent from the result. Its fence is
 * stripped from the prose before anything sees it, so it has no line and
 * therefore no distance — and inventing one ("the writer typed it on this page,
 * call it near") would be the app asserting a connection nobody made. The page
 * still carries it, and opening the page still shows it in the margin.
 */
export function markingsNear(
  entries: Entry[],
  markings: readonly PageMarking[],
  match: RegExp | null,
  within = NEAR_LINES,
): NearMarking[] {
  if (!match) return []
  const byEntry = new Map<string, PageMarking[]>()
  for (const m of markings) {
    const held = byEntry.get(m.entryId)
    if (held) held.push(m)
    else byEntry.set(m.entryId, [m])
  }

  const out: NearMarking[] = []
  // Oldest first — the order she wrote them in, which is the only order here
  // that is not a claim about which of them matters.
  const ordered = entries
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  for (const entry of ordered) {
    const here = byEntry.get(entry.id)
    if (!here || here.length === 0) continue
    const lines = entryContentLines(entry.body_markdown)
    if (lines.length === 0) continue
    const mentions = mentionLines(lines, match)
    if (mentions.length === 0) continue
    const flat = lines.map(flatten)

    for (const marking of here) {
      const at = markingLine(lines, flat, marking)
      if (at < 0) continue
      let nearest = Number.POSITIVE_INFINITY
      for (const m of mentions) nearest = Math.min(nearest, Math.abs(m - at))
      if (nearest <= within) out.push({ entry, marking, distance: nearest })
    }
  }
  return out
}

/** "on the same line", "two lines away" — a fact, never a score. */
export function distanceText(distance: number): string {
  if (distance === 0) return 'on the same line'
  if (distance === 1) return 'the next line'
  return `${distance} lines away`
}
