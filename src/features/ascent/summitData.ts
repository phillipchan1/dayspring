/**
 * SUMMIT aggregation — the year, built almost entirely from things the USER
 * created or marked. The app SELECTS + ARRANGES; it never narrates what the year
 * meant. Pulls structured data, not prose:
 *   • Altar encounters (prayers He met you in)  → gold trail stones
 *   • Lamp most-returned reference               → the verse + a blue stone
 *   • one VERBATIM line from an entry            → the year's refrain
 *   • months written                             → the height of solid rock
 *
 * The yearly rollup's generated `throughline` prose is intentionally NOT
 * surfaced here — the summit is where the app goes quiet.
 */

import { listThreads } from '@/lib/altar/query'
import { listRollups } from '@/lib/insights'
import { getReturning } from '@/lib/scripture/query'
import { formatOsisRef } from '@/lib/scripture/format'
import { MOVEMENT_LABEL } from '@/lib/types'
import { seasonOf, YEAR_MONTHS } from './ascent.config'

export interface TrailStone {
  /** 1–12; positions the stone along the trail. */
  month: number
  label: string
  kind: 'altar' | 'lamp'
}

export interface SummitData {
  year: number
  monthsDone: number
  total: number
  complete: boolean
  stones: TrailStone[]
  prayersMet: number
  verse: string | null
  refrain: { text: string; entryId: string } | null
  /** The season the user wrote most (by words), or null when unknown. */
  seasonWroteMost: string | null
}

const MAX_TRAIL_STONES = 10

function yearOf(dateLike: string): number {
  return new Date(dateLike).getUTCFullYear()
}

export async function loadSummit(): Promise<SummitData> {
  const [yearlies, monthlies, threads, returning] = await Promise.all([
    listRollups('yearly'),
    listRollups('monthly'),
    listThreads().catch(() => []), // Altar may be empty/unreachable — degrade, don't fail.
    getReturning(1).catch(() => []),
  ])

  // The year in view: the latest yearly rollup, else the latest month, else now.
  const year =
    yearlies[0] != null
      ? yearOf(`${yearlies[0].period_start}T00:00:00Z`)
      : monthlies[0] != null
        ? yearOf(`${monthlies[0].period_start}T00:00:00Z`)
        : new Date().getUTCFullYear()

  const monthsThisYear = monthlies.filter(
    (m) => yearOf(`${m.period_start}T00:00:00Z`) === year,
  )
  const monthsDone = monthsThisYear.length
  const complete = monthsDone >= YEAR_MONTHS

  // Gold stones: Altar encounters the user named within the year.
  const lit = threads.filter(
    (t) => t.state === 'lit' && t.named_at != null && yearOf(t.named_at) === year,
  )
  const altarStones: TrailStone[] = lit
    .slice()
    .sort((a, b) => (a.named_at ?? '').localeCompare(b.named_at ?? ''))
    .map((t) => ({
      month: new Date(t.named_at as string).getUTCMonth() + 1,
      label: `${t.title} — ${t.movement ? MOVEMENT_LABEL[t.movement] : 'He met me'}`,
      kind: 'altar' as const,
    }))

  // Blue stone: the verse the user keeps returning to (placed at the latest month).
  const top = returning[0]
  const verse = top ? formatOsisRef(top.osis_ref) : null
  const lampStones: TrailStone[] = verse
    ? [{ month: Math.max(1, monthsDone), label: verse, kind: 'lamp' }]
    : []

  const stones = [...altarStones, ...lampStones].slice(0, MAX_TRAIL_STONES)

  // The refrain: verbatim user line from the yearly rollup; fallback to the
  // verbatim "later" half of the strongest answered stone (still the user's words).
  const yc = yearlies[0]?.payload.reflection
  const refrain =
    yc?.refrain != null
      ? { text: yc.refrain.text, entryId: yc.refrain.entry_id }
      : yc?.stones?.[0]?.later
        ? { text: yc.stones[0].later.text, entryId: yc.stones[0].later.entry_id }
        : null

  // The season written most, by word count across the year's months.
  let busiest: { month: number; words: number } | null = null
  for (const m of monthsThisYear) {
    const words = m.payload.facts?.words ?? 0
    const month = new Date(`${m.period_start}T00:00:00Z`).getUTCMonth()
    if (busiest === null || words > busiest.words) busiest = { month, words }
  }
  const seasonWroteMost = busiest && busiest.words > 0 ? seasonOf(busiest.month) : null

  return {
    year,
    monthsDone,
    total: YEAR_MONTHS,
    complete,
    stones,
    prayersMet: lit.length,
    verse,
    refrain,
    seasonWroteMost,
  }
}
