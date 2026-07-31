/**
 * The Ascent data seam — the single orchestration point. Reads the real rollups
 * ONCE, derives each altitude's time window from the journal's anchor, and
 * composes the per-altitude view models from the four dimension adapters (real:
 * words + scripture; mock: prayer + learning + stones).
 *
 * Swapping a mock dimension for a real one is a one-file change in `./<dimension>`
 * — this file's composition does not change.
 */

import { listRollups } from '@/lib/insights'
import { isListingPreview } from '@/lib/previewMode'
import { confirmScriptureRef, loadScripture, loadVerseDrill, type Windows, type VerseDrill } from './scripture'
import type { AltitudeData, AscentData, Resolution, ScriptureData, SummitView } from './types'
import { loadWeekWords, monthWords, quarterWords, yearWords } from './words'

export type { Windows, VerseDrill }
export { loadVerseDrill, confirmScriptureRef }

/** Everything the view needs, plus the windows the drill-in reads. */
export interface LoadedAscent extends AscentData {
  windows: Windows
}

function dayStart(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 0, 0, 0))
}
function dayEnd(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d, 23, 59, 59))
}

/** Anchor every altitude's window to TODAY (live), not to the latest rollup. The
 *  Valley is the trailing 7 days — the days you're actually living — so it never
 *  feels stale waiting on a Monday rebuild, and it stays correct for a user whose
 *  rollups haven't been synthesized yet. Month/quarter/year are the current
 *  calendar period to-date. (`Date.UTC` rolls a negative day back across the month
 *  boundary, so a trailing week that spans two months is handled for free.) */
function deriveWindows(): Windows {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const d = now.getUTCDate()
  const q = Math.floor(m / 3)

  return {
    week: { from: dayStart(y, m, d - 6), to: dayEnd(y, m, d) },
    month: { from: dayStart(y, m, 1), to: dayEnd(y, m + 1, 0) },
    quarter: { from: dayStart(y, q * 3, 1), to: dayEnd(y, q * 3 + 3, 0) },
    year: { from: dayStart(y, 0, 1), to: dayEnd(y, 11, 31) },
  }
}

/** Carry the words period label onto the scripture block so the altitude reads
 *  as one span (scripture queries return no label of their own). */
function withLabel(scripture: ScriptureData | null, label: string | undefined): ScriptureData | null {
  if (!scripture) return null
  return { ...scripture, periodLabel: label ?? scripture.periodLabel }
}

export async function loadAscent(): Promise<LoadedAscent> {
  // App Store listing preview: serve fixtures rather than Supabase. Kept inline
  // under a literal `import.meta.env.DEV` (not hoisted to a module const) so Vite
  // drops the branch AND the dynamic import — the fixtures never reach the bundle.
  // Needed because AscentView's load rejection sets loadError, which wins the
  // render and would photograph an error state.
  if (import.meta.env.DEV && isListingPreview()) {
    return (await import('@/features/appstore/mock')).MOCK_ASCENT
  }

  // Degrade per-tier: if a rollup read fails (offline / not yet synthesized), the
  // real Words/Scripture dimensions fall to empty while the rest of the climb —
  // and the other dimensions — still render.
  const [weekly, monthly, yearly] = await Promise.all([
    listRollups('weekly').catch(() => []),
    listRollups('monthly').catch(() => []),
    listRollups('yearly').catch(() => []),
  ])
  const windows = deriveWindows()
  const yearNum = windows.year.from!.getUTCFullYear()

  const [weekWords, scrWeek, scrMonth, scrQuarter, scrYear] = await Promise.all([
    loadWeekWords(weekly[0], windows.week),
    loadScripture('week', windows.week).catch(() => null),
    loadScripture('month', windows.month).catch(() => null),
    loadScripture('quarter', windows.quarter).catch(() => null),
    loadScripture('year', windows.year).catch(() => null),
  ])

  const monWords = monthWords(monthly[0])
  const quaWords = quarterWords(monthly)
  const yeaWords = yearWords(yearly[0])

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
    stones: [],
  }

  return { week, month, quarter, year, windows }
}

export type { AltitudeData, AscentData, Resolution, ScriptureData, SummitView }
