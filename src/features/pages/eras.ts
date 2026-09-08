// Eras — where the writing breaks, and nothing more than that.
//
// Progoff's Stepping Stones, which `docs/product/DIRECTOR_MOVES.md` files as
// move 2 and operator 3 (`cluster by date`, no model): ten or twelve periods,
// listed fast. It carries its own rule and the rule is the whole design:
//
//   > `bursts` produces the candidate set; the WRITER names them.
//
// So this proposes brackets and never names one. A chip says "2018 – 2020 · 412"
// — two dates and a count, both facts about the archive. The moment it says
// "your hardest season" the app is narrating somebody's life back at them from a
// page count, which is a verdict rendered as a label (Principle 1, D-016).
//
// ── This is `bursts`, projected onto the timeline ───────────────────────────
//
// It does NOT define its own silence. `readings.ts` already answers "where does
// this journal break", the `close together` reading is already built on it, and
// two rules would mean the era chips and that reading disagreed about the same
// archive — you would press "2018 – 2020", choose `close together`, and be shown
// different seams than the chip you pressed.
//
// Its threshold is also better than a constant, and `quietFor` says why: *"A
// fixed threshold cannot work. Fifty days is a long silence for someone who
// writes about their mother twice a year and no silence at all for someone who
// writes every morning."* Six times the median gap, clamped, measured on this
// writer. An invented "three months" would have been exactly the mistake that
// note was written to prevent.
//
// All this module adds is the projection onto the Stretch's month grid, and one
// floor — `floorFor`, the same one page in a hundred the subject list and the
// Life Map use, so a stray page or two between two long silences is not offered
// as a period of somebody's life.

import { floorFor } from '@/features/lifemap/lifeMap'
import type { Entry } from '@/lib/types'
import { bursts } from './readings'

export interface Era {
  /** Indices into the shared month list — the same coordinates a `Span` uses. */
  from: number
  to: number
  /** Pages inside it. Shown; never sorted by. */
  pages: number
}

type Month = { year: number; month: number }

/** Where a date falls in the archive's contiguous month list. */
function monthIndex(iso: string, months: readonly Month[]): number {
  const first = months[0]
  if (!first) return 0
  const t = new Date(iso)
  const n = t.getFullYear() * 12 + t.getMonth() - (first.year * 12 + first.month)
  return Math.max(0, Math.min(months.length - 1, n))
}

/**
 * The candidate periods, in the order they happened.
 *
 * ONE ERA IS NO ERAS. A journal whose rhythm never breaks has no seams, and the
 * honest answer is to offer nothing rather than to invent a boundary or hand
 * back a single chip that brackets everything — which is what "no bracket"
 * already means. Someone who wrote daily for eleven years sees no chips, and
 * that is a true thing about their journal rather than a gap in the feature.
 */
export function erasFrom(entries: Entry[], months: readonly Month[]): Era[] {
  if (months.length === 0) return []
  const out = bursts(entries, { min: floorFor(entries.length) }).map((b) => ({
    // The burst's own first and last PAGE, so a bracket never runs out into
    // empty months — its tail is the last month someone actually wrote in.
    from: monthIndex(b.entries[0]!.created_at, months),
    to: monthIndex(b.entries[b.entries.length - 1]!.created_at, months),
    pages: b.entries.length,
  }))
  return out.length < 2 ? [] : out
}

/** "2018 – 2020", or one year when that is all it is. */
export function eraLabel(era: Era, months: readonly Month[]): string {
  const a = months[era.from]?.year
  const b = months[era.to]?.year
  if (a === undefined || b === undefined) return ''
  return a === b ? String(a) : `${a} – ${b}`
}
