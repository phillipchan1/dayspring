/**
 * SINCE YOUR LAST CLIMB — the quietest possible hook, and the riskiest line on
 * the surface.
 *
 * It is one degree from a notification, and it stays defensible only while it
 * obeys two rules:
 *
 * 1. **It reports content, never behaviour.** A stone was set; a line rose to
 *    the top. It never counts entries, never names a gap, never says how long
 *    it has been. Nothing here can be earned by writing more (PRINCIPLES #2).
 * 2. **It is silent by default.** In the months when nothing arrived it says
 *    nothing at all, which is most months. A line that always has something to
 *    announce is manufacturing news.
 *
 * Per-device on purpose: this is "what changed since *this* screen last showed
 * you the year", which is a property of the screen, not of the account.
 */

import type { SummitStone } from './data/types'

const KEY = 'dayspring:summit-last-climb'

interface Mark {
  year: number
  stoneIds: string[]
  hadRefrain: boolean
}

export interface SinceLastClimb {
  /** New stones set since the last visit, oldest first. */
  newStones: SummitStone[]
  /** True when a refrain appeared where there was none. */
  refrainArrived: boolean
}

function read(): Mark | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Mark>
    if (typeof parsed?.year !== 'number' || !Array.isArray(parsed.stoneIds)) return null
    return {
      year: parsed.year,
      stoneIds: parsed.stoneIds.filter((x): x is string => typeof x === 'string'),
      hadRefrain: parsed.hadRefrain === true,
    }
  } catch {
    return null
  }
}

function write(mark: Mark): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(mark))
  } catch {
    // Losing the mark costs one silent visit, never a render.
  }
}

/**
 * What arrived since this screen last showed the year. PURE — it only reads.
 *
 * Reading and recording are deliberately two calls. Doing both at once meant
 * writing to storage during render, and React renders a component twice in
 * development: the first pass recorded, the second compared against what the
 * first had just written, and the line was silent in dev and talkative in
 * production. Now the diff is computed in render and `recordClimb` is an effect,
 * which runs after both passes and is idempotent.
 *
 * The FIRST ever climb reports nothing: everything is new then, and announcing
 * a year's worth of stones as though they just landed would be a lie about time.
 * A change of year does the same — the new year starts empty by definition.
 */
export function sinceLastClimb(
  year: number,
  stones: SummitStone[],
  hasRefrain: boolean,
): SinceLastClimb {
  const previous = read()
  if (!previous || previous.year !== year) return { newStones: [], refrainArrived: false }

  const before = new Set(previous.stoneIds)
  return {
    newStones: stones.filter((s) => !before.has(s.id)),
    refrainArrived: hasRefrain && !previous.hadRefrain,
  }
}

/** Record where the year stands now, so the next visit compares against this one. */
export function recordClimb(year: number, stones: SummitStone[], hasRefrain: boolean): void {
  write({ year, stoneIds: stones.map((s) => s.id), hadRefrain: hasRefrain })
}
