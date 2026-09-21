/**
 * WHAT MOVED THIS SEASON — dates, not meanings.
 *
 * Four piles, each a fact about when you wrote, never about what it meant:
 *
 *   began            present this season, not in the one before, nor the year before that
 *   came back        present this season, absent last season, present earlier in the year
 *   carried through  present this season and last
 *   went quiet       present last season, not (yet) this one
 *
 * While the season is still running, "went quiet" is reported as "not yet" —
 * three weeks into fall, a thread you haven't written about is not quiet, it
 * just hasn't come up.
 */

import type { LedgerLine, LedgerThread, RangeLedger } from './build'

export interface MovedItem {
  thread: LedgerThread
  /** The line that shows it: the first this season (began / came back), the
   *  latest this season (carried), the last one last season (quiet). */
  line: LedgerLine | null
}

export interface Moved {
  began: MovedItem[]
  cameBack: MovedItem[]
  carried: MovedItem[]
  quiet: MovedItem[]
}

const PER_PILE = 4

/** Words in a line. */
const words = (s: string) => s.split(/\s+/).filter(Boolean).length

/**
 * The line that shows a thread: nearest the chosen end, but one with enough
 * words to say something — a page whose only mention is the bare word
 * "dayspring" tells you nothing. Falls back to the end line itself.
 */
export function substantive(lines: LedgerLine[], end: 'first' | 'last', min = 5): LedgerLine | null {
  if (lines.length === 0) return null
  const ordered = end === 'first' ? lines : lines.slice().reverse()
  return ordered.find((l) => words(l.text) >= min) ?? ordered[0]!
}

export function whatMoved(season: RangeLedger, previous: RangeLedger, earlierIds: ReadonlySet<string>): Moved {
  const prevIds = new Set(previous.threads.map((t) => t.id))
  const nowIds = new Set(season.threads.map((t) => t.id))
  const first = (t: LedgerThread) => substantive(t.lines, 'first')
  const last = (t: LedgerThread) => substantive(t.lines, 'last')

  const began: MovedItem[] = []
  const cameBack: MovedItem[] = []
  const carried: MovedItem[] = []
  for (const t of season.threads) {
    if (prevIds.has(t.id)) carried.push({ thread: t, line: last(t) })
    else if (earlierIds.has(t.id)) cameBack.push({ thread: t, line: first(t) })
    else began.push({ thread: t, line: first(t) })
  }
  const quiet = previous.threads.filter((t) => !nowIds.has(t.id)).map((t) => ({ thread: t, line: last(t) }))

  return {
    began: began.slice(0, PER_PILE),
    cameBack: cameBack.slice(0, PER_PILE),
    carried: carried.slice(0, PER_PILE),
    quiet: quiet.slice(0, PER_PILE),
  }
}
