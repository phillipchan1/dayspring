/**
 * Scripture — the REAL adapter, and the proof the pattern works end-to-end. It
 * wraps the existing Scripture surface queries (`src/lib/scripture/query.ts`) and
 * reads `scripture_refs` directly. Heat is distinct-entry count, never a "% of
 * Bible covered" — this is a mirror of affection, not a coverage scoreboard.
 *
 * The volume inverts by resolution: the Valley shows the several verses you
 * reached for; the Summit shows the one verse of the year. The drill-in lays
 * every moment a verse surfaced along the season, shows the verse's RISE across
 * altitudes, and offers the quiet confirm funnel for faint (suggested) allusions.
 */

import { confirmScriptureRef } from '@/lib/scripture/confirm'
import { formatOsisRef } from '@/lib/scripture/format'
import {
  getReturning,
  getSuggestedCount,
  getVerseMoments,
  type DateWindow,
  type VerseMoment,
} from '@/lib/scripture/query'
import type { Resolution, ScriptureData, ScriptureRefItem } from './types'

export { confirmScriptureRef }
export type { VerseMoment }

/** The time window for each altitude. Built by the seam from the journal's anchor. */
export type Windows = Record<Resolution, DateWindow>

/** How many verses to surface per altitude — fewer + more distilled as you climb. */
const LIMIT: Record<Resolution, number> = { week: 8, month: 4, quarter: 2, year: 1 }

export async function loadScripture(
  resolution: Resolution,
  window: DateWindow,
): Promise<ScriptureData | null> {
  const [returning, suggestedCount] = await Promise.all([
    getReturning(LIMIT[resolution], window),
    getSuggestedCount(window),
  ])
  if (returning.length === 0 && suggestedCount === 0) return null
  const refs: ScriptureRefItem[] = returning.map((r) => ({
    osisRef: r.osis_ref,
    label: formatOsisRef(r.osis_ref),
    count: r.count,
  }))
  return { resolution, periodLabel: '', refs, suggestedCount }
}

// ── drill-in: one verse, laid along the season + its rise across altitudes ─────

export interface VerseRiseBucket {
  resolution: Resolution
  /** Distinct entries that reached for the verse within that altitude's window. */
  count: number
}

export interface VerseDrill {
  osisRef: string
  label: string
  /** Every moment the verse surfaced — confirmed solidly, suggested faintly. */
  moments: VerseMoment[]
  /** The verse's rise: week → month → quarter → year, by distinct-entry count. */
  rise: VerseRiseBucket[]
}

const RESOLUTIONS: Resolution[] = ['week', 'month', 'quarter', 'year']

export async function loadVerseDrill(osisRef: string, windows: Windows): Promise<VerseDrill> {
  // All moments across history (no window) — the drill shows the whole thread.
  const moments = await getVerseMoments(osisRef)

  // Rise: distinct confirmed entries inside each altitude's window.
  const rise: VerseRiseBucket[] = RESOLUTIONS.map((resolution) => {
    const w = windows[resolution]
    const ids = new Set<string>()
    for (const m of moments) {
      if (m.status !== 'confirmed') continue
      const t = Date.parse(m.entry_created_at)
      if (w.from && t < w.from.getTime()) continue
      if (w.to && t > w.to.getTime()) continue
      ids.add(m.entry_id)
    }
    return { resolution, count: ids.size }
  })

  return { osisRef, label: formatOsisRef(osisRef), moments, rise }
}
