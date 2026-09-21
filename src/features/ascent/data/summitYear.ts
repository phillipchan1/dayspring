/**
 * THE YEARS BEHIND YOU — loading a Summit other than the one you are standing in.
 *
 * The open year and a sealed year are the same surface read two ways. The open
 * year is lit to today and still gaining stones; a sealed year is lit end to
 * end, its peak lit, holding every stone it ever set and a throughline that is
 * finished. Nothing about a past year is provisional, which is why it needs no
 * "since your last climb" and no invitation to write — those belong to the year
 * that is still running.
 *
 * Loaded on demand rather than with the climb: an archive of fifteen years must
 * not cost fifteen rollup payloads to open the Ascent.
 */

import { getCache, setCache } from '@/lib/asyncCache'
import { getRollupForPeriod, listRollupPeriods } from '@/lib/insights'
import { grainWindow } from '@/lib/period'
import { isCapturePreview } from '@/lib/previewMode'
import { loadScripture } from './scripture'
import { yearProgress, yearStones } from './stones'
import type { SummitView } from './types'
import { withCheckedRefrain } from './refrainCheck'
import { yearLongLook, yearWords } from './words'

/** The calendar window of a whole year, in the shared calendar's terms. */
export function windowForYear(year: number) {
  return grainWindow('year', new Date(Date.UTC(year, 6, 1)))
}

/**
 * The years the rail offers, newest first: every year that has a yearly rollup,
 * plus the current one — which belongs on the rail from 1 January, before it has
 * anything in it, because it is the year you are standing in.
 */
export async function listSummitYears(now: Date = new Date()): Promise<number[]> {
  const thisYear = now.getUTCFullYear()
  // Listing preview: the rail is one of the clearest things the shots can say —
  // that this is an archive, not a dashboard — so it is served from fixtures
  // rather than left empty. Inline under a literal `import.meta.env.DEV` so Vite
  // drops the branch, exactly as the climb seam does.
  if (import.meta.env.DEV && isCapturePreview()) {
    return Array.from({ length: 8 }, (_, i) => thisYear - i)
  }
  const periods = await listRollupPeriods('yearly').catch(() => [])
  return mergeYears(periods, thisYear)
}

/** The rail's ordering rule, pure so it can be pinned: newest first, the current
 *  year always present, anything unparseable dropped rather than rendered. */
export function mergeYears(periodStarts: string[], thisYear: number): number[] {
  const years = new Set<number>([thisYear])
  for (const p of periodStarts) {
    const y = Number(p.slice(0, 4))
    if (Number.isInteger(y) && y > 1900 && y < 3000) years.add(y)
  }
  return [...years].sort((a, b) => b - a)
}

/** A sealed year never changes, so it is cached for the session rather than
 *  re-read every time the rail is touched. The OPEN year is deliberately not
 *  cached here — the climb already owns it, and it is the one that moves. */
function cacheKey(year: number): string {
  return `ascent:summit:${year}`
}

export async function loadSummitYear(year: number, now: Date = new Date()): Promise<SummitView> {
  const sealed = year < now.getUTCFullYear()
  if (sealed) {
    const hit = getCache<SummitView>(cacheKey(year))
    if (hit) return hit
  }

  const window = windowForYear(year)
  const [rollup, scripture] = await Promise.all([
    getRollupForPeriod('yearly', `${year}-01-01`).catch(() => null),
    loadScripture('year', window).catch(() => null),
  ])

  const words = await withCheckedRefrain(yearWords(rollup, year))
  const view: SummitView = {
    resolution: 'year',
    words,
    scripture: scripture ? { ...scripture, periodLabel: String(year) } : null,
    prayer: null,
    learning: null,
    year,
    stones: yearStones(rollup, year),
    longLook: yearLongLook(rollup),
    // A year that has ended is walked all the way to the peak, whatever was
    // written in it. Progress is the calendar, never the writer.
    progress: sealed ? 1 : yearProgress(now),
  }

  if (sealed) setCache(cacheKey(year), view)
  return view
}
