/**
 * STONES — the Summit's accumulation, read off the yearly rollup.
 *
 * `buildYearly` has always produced these (`reflection.stones`: an earlier ask
 * paired with a later moment, both copied verbatim from real entries and both
 * validated against their sources by `validatePairs`). Nothing in the app read
 * them until now — the year's one genuinely cumulative thing was generated and
 * discarded every time.
 *
 * A stone is placed on the trail by the date of its LATER half: the pairing does
 * not exist until the answer arrives. So the trail gains a marker when something
 * happens in a life, never when someone writes enough.
 */

import type { EbenezerPair, Rollup } from '@/lib/insights'
import type { StoneMark, SummitStone } from './types'
import { fmtDay } from './words'

const DAY_MS = 86_400_000

/** Where a date falls in its calendar year, 0–1. Clamped, because a rollup can
 *  carry a pairing whose halves sit either side of a year boundary. */
export function positionInYear(date: string, year: number): number {
  const at = Date.parse(`${date.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(at)) return 0
  const start = Date.UTC(year, 0, 1)
  const span = Date.UTC(year + 1, 0, 1) - start
  return Math.min(1, Math.max(0, (at - start) / span))
}

/** How far into the calendar year `now` is, 0–1 — the lit stretch of trail. */
export function yearProgress(now: Date = new Date()): number {
  const year = now.getUTCFullYear()
  const start = Date.UTC(year, 0, 1)
  const span = Date.UTC(year + 1, 0, 1) - start
  return Math.min(1, Math.max(0, (now.getTime() - start) / span))
}

function toMark(x: { entry_id: string; date: string; text: string }): StoneMark {
  return { entryId: x.entry_id, date: x.date.slice(0, 10), dateLabel: fmtDay(x.date), text: x.text }
}

/** True when a pairing is well-formed enough to set on the trail. Both halves
 *  must name a real entry and carry words; the ask must come BEFORE the answer,
 *  which is the whole claim a stone makes. */
function usable(p: EbenezerPair): boolean {
  if (!p.ask?.entry_id || !p.later?.entry_id) return false
  if (!p.ask.text?.trim() || !p.later.text?.trim()) return false
  const askAt = Date.parse(`${p.ask.date.slice(0, 10)}T00:00:00Z`)
  const laterAt = Date.parse(`${p.later.date.slice(0, 10)}T00:00:00Z`)
  if (!Number.isFinite(askAt) || !Number.isFinite(laterAt)) return false
  return laterAt - askAt >= DAY_MS
}

/**
 * The year's stones, oldest answer first so the trail reads bottom-to-top the
 * way it was climbed. Deduped on the pair of entries: a rebuild of the open year
 * can surface the same pairing under a fresh id, and the same moment must not
 * sit on the mountain twice.
 */
export function yearStones(yearly: Rollup | undefined | null, year: number): SummitStone[] {
  const pairs = yearly?.payload.reflection?.stones ?? []
  const seen = new Set<string>()
  const out: SummitStone[] = []
  for (const p of pairs) {
    if (!usable(p)) continue
    const key = `${p.ask.entry_id}→${p.later.entry_id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      id: p.id,
      ask: toMark(p.ask),
      later: toMark(p.later),
      position: positionInYear(p.later.date, year),
    })
  }
  return out.sort((a, b) => a.position - b.position)
}
