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

export function whatMoved(season: RangeLedger, previous: RangeLedger, earlierIds: ReadonlySet<string>): Moved {
  const prevIds = new Set(previous.threads.map((t) => t.id))
  const nowIds = new Set(season.threads.map((t) => t.id))
  const first = (t: LedgerThread) => t.lines[0] ?? null
  const last = (t: LedgerThread) => t.lines[t.lines.length - 1] ?? null

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
