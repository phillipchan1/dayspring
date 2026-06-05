/**
 * The Ascent data seam — the single orchestration point. Reads the real rollups
 * ONCE, derives each altitude's time window from the journal's anchor, and
 * composes the per-altitude view models from the four dimension adapters (real:
 * words + scripture; mock: prayer + learning + stones).
 *
 * Swapping a mock dimension for a real one is a one-file change in `./<dimension>`
 * — this file's composition does not change.
 */

import { listRollups, type Rollup } from '@/lib/insights'
import type { DateWindow } from '@/lib/scripture/query'
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

/** Anchor every altitude's window to the latest week the journal actually has
 *  (so Scripture lines up with the entries the Valley shows), else to today. */
function deriveWindows(weekly: Rollup | undefined): Windows {
  const anchorISO = weekly?.period_end ?? new Date().toISOString().slice(0, 10)
  const d = new Date(`${anchorISO}T00:00:00Z`)
  const y = d.getUTCFullYear()
  const m = d.getUTCMonth()
  const q = Math.floor(m / 3)

  const week: DateWindow = weekly
    ? {
        from: new Date(`${weekly.period_start}T00:00:00Z`),
        to: new Date(`${weekly.period_end}T23:59:59Z`),
      }
    : { from: dayStart(y, m, d.getUTCDate() - 6), to: dayEnd(y, m, d.getUTCDate()) }

  return {
    week,
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
  // Degrade per-tier: if a rollup read fails (offline / not yet synthesized), the
  // real Words/Scripture dimensions fall to empty while the rest of the climb —
  // and the other dimensions — still render.
  const [weekly, monthly, yearly] = await Promise.all([
    listRollups('weekly').catch(() => []),
    listRollups('monthly').catch(() => []),
    listRollups('yearly').catch(() => []),
  ])
  const windows = deriveWindows(weekly[0])
  const yearNum = windows.year.from!.getUTCFullYear()

  const [weekWords, scrWeek, scrMonth, scrQuarter, scrYear] = await Promise.all([
    loadWeekWords(weekly[0]),
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
