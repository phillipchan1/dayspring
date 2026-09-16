/**
 * The Ascent data seam — the single orchestration point. Reads the real rollups
 * ONCE, derives each altitude's time window from the journal's anchor, and
 * composes the per-altitude view models from the four dimension adapters (real:
 * words + scripture; mock: prayer + learning + stones).
 *
 * Swapping a mock dimension for a real one is a one-file change in `./<dimension>`
 * — this file's composition does not change.
 */

import { assertSameOwner, cacheGeneration, getCache, onCacheCleared, setCache } from '@/lib/asyncCache'
import { getRollupForPeriod, listRollups } from '@/lib/insights'
import { grainWindow } from '@/lib/period'
import { isListingPreview } from '@/lib/previewMode'
import { prewarmScripture } from '@/lib/scripture/query'
import { confirmScriptureRef, loadScripture, loadVerseDrill, type Windows, type VerseDrill } from './scripture'
import { yearProgress, yearStones } from './stones'
import type { AltitudeData, AscentData, Resolution, ScriptureData, SummitView } from './types'
import { loadWeekWords, monthWords, quarterWords, yearLongLook, yearWords } from './words'

export type { Windows, VerseDrill }
export { loadVerseDrill, confirmScriptureRef }

/** Everything the view needs, plus the windows the drill-in reads. */
export interface LoadedAscent extends AscentData {
  windows: Windows
}

/** Every altitude's window, from the ONE calendar the Remember surfaces share
 *  (`src/lib/period.ts`). Nothing trailing lives here any more: the Valley is the
 *  calendar week the weekly rollup is built on, and each altitude nests exactly
 *  inside the one above it — which is what lets a stone laid in March have an
 *  unambiguous place on the year's trail. */
function deriveWindows(now: Date = new Date()): Windows {
  return {
    week: grainWindow('week', now),
    month: grainWindow('month', now),
    quarter: grainWindow('season', now),
    year: grainWindow('year', now),
  }
}

/** Carry the words period label onto the scripture block so the altitude reads
 *  as one span (scripture queries return no label of their own). */
function withLabel(scripture: ScriptureData | null, label: string | undefined): ScriptureData | null {
  if (!scripture) return null
  return { ...scripture, periodLabel: label ?? scripture.periodLabel }
}

/** The composed climb, cached across unmounts so returning to the Ascent paints
 *  from memory instead of re-reading. Stamped with the UTC day the windows were
 *  derived from — a climb built yesterday must not paint today's Valley. */
const ASCENT_CACHE = 'ascent:climb:v1'

interface CachedAscent {
  day: string
  data: LoadedAscent
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The last composed climb, if it was built today. Lets the view paint instantly
 *  and revalidate behind — the surface should never make you wait twice. */
export function readCachedAscent(): LoadedAscent | undefined {
  const hit = getCache<CachedAscent>(ASCENT_CACHE)
  return hit && hit.day === todayKey() ? hit.data : undefined
}

let inflight: Promise<LoadedAscent> | null = null

// A scrub (sign-out / owner change) drops the in-flight climb with the cache, so
// the next caller can't join a read started by the previous owner.
onCacheCleared(() => {
  inflight = null
})

export async function loadAscent(opts?: { fresh?: boolean }): Promise<LoadedAscent> {
  if (!opts?.fresh) {
    const cached = readCachedAscent()
    if (cached) return cached
  }
  // Two mounts racing (StrictMode, a fast re-nav) should cost one set of reads.
  if (inflight) return inflight
  inflight = loadAscentOnce(opts).finally(() => {
    inflight = null
  })
  return inflight
}

async function loadAscentOnce(opts?: { fresh?: boolean }): Promise<LoadedAscent> {
  const gen = cacheGeneration()
  // App Store listing preview: serve fixtures rather than Supabase. Kept inline
  // under a literal `import.meta.env.DEV` (not hoisted to a module const) so Vite
  // drops the branch AND the dynamic import — the fixtures never reach the bundle.
  // Needed because AscentView's load rejection sets loadError, which wins the
  // render and would photograph an error state.
  if (import.meta.env.DEV && isListingPreview()) {
    return (await import('@/features/appstore/mock')).MOCK_ASCENT
  }

  const windows = deriveWindows()

  // Degrade per-tier: if a rollup read fails (offline / not yet synthesized), the
  // real Words/Scripture dimensions fall to empty while the rest of the climb —
  // and the other dimensions — still render.
  //
  // Only the newest rollup of each tier is read (the quarter is composed from the
  // months spanning it, and a quarter holds three), so the fat `structured_payload`
  // of every rollup ever written stays on the server. The scripture prewarm runs
  // alongside: one pass over the union of the four altitude windows, after which
  // each `loadScripture` below is an in-memory filter rather than its own scan.
  const yearNum = windows.year.from!.getUTCFullYear()

  const [weekly, monthly, yearly] = await Promise.all([
    listRollups('weekly', 1).catch(() => []),
    listRollups('monthly', 3).catch(() => []),
    // THIS year by name, not the newest yearly row. `listRollups('yearly', 1)`
    // returned whichever year was built last — which, with the year only ever
    // built on Jan 1 for the year just gone, meant the Summit spent all of a
    // year showing the PREVIOUS year's refrain beside the current year's verse,
    // under the current year's heading. Two vintages under one roof.
    getRollupForPeriod('yearly', `${yearNum}-01-01`).catch(() => null),
    prewarmScripture(Object.values(windows), opts),
  ])

  const [weekWords, scrWeek, scrMonth, scrQuarter, scrYear] = await Promise.all([
    loadWeekWords(weekly[0], windows.week),
    loadScripture('week', windows.week).catch(() => null),
    loadScripture('month', windows.month).catch(() => null),
    loadScripture('quarter', windows.quarter).catch(() => null),
    loadScripture('year', windows.year).catch(() => null),
  ])

  const monWords = monthWords(monthly[0])
  const quaWords = quarterWords(monthly)
  const yeaWords = yearWords(yearly, yearNum)

  // Prayer/learning/stones are retired (the converged Ascent reads the rope engine
  // for its content); only the real Words + Scripture dimensions feed the seam now.
  const week: AltitudeData = {
    resolution: 'week',
    words: weekWords,
    scripture: withLabel(scrWeek, weekWords?.periodLabel),
    prayer: null,
    learning: null,
  }
  const month: AltitudeData = {
    resolution: 'month',
    words: monWords,
    scripture: withLabel(scrMonth, monWords?.periodLabel),
    prayer: null,
    learning: null,
  }
  const quarter: AltitudeData = {
    resolution: 'quarter',
    words: quaWords,
    scripture: withLabel(scrQuarter, quaWords?.periodLabel),
    prayer: null,
    learning: null,
  }
  const year: SummitView = {
    resolution: 'year',
    words: yeaWords,
    scripture: withLabel(scrYear, yeaWords?.periodLabel ?? String(yearNum)),
    prayer: null,
    learning: null,
    year: yearNum,
    stones: yearStones(yearly, yearNum),
    longLook: yearLongLook(yearly),
    progress: yearProgress(),
  }

  const climb: LoadedAscent = { week, month, quarter, year, windows }
  assertSameOwner(gen)
  setCache<CachedAscent>(ASCENT_CACHE, { day: todayKey(), data: climb })
  return climb
}

export type { AltitudeData, AscentData, Resolution, ScriptureData, SummitView }
