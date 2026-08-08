// What the wall lays out, and what a selection is allowed to contain.
//
// Pulled out of PageWall because these two lists disagreeing is the surface's
// sharpest failure mode, and disagreement is invisible in a component.

import type { Entry } from '@/lib/types'
import { anniversaryLabel, findAnniversaries } from './anniversaries'

export interface WallItem {
  /** React key. Carries the anchor for echoes, because an id can repeat. */
  key: string
  entry: Entry
  /** Set when this page has risen out of an earlier year. */
  echo?: string
}

/**
 * Every card on the wall, in order.
 *
 * @param cols  Echo spacing is measured in ROWS, not pages: a fixed page gap
 *              puts two echoes on one screen at eight columns and one every few
 *              screens at two.
 */
export function buildWallItems(entries: Entry[], echoes: boolean, cols: number): WallItem[] {
  if (!echoes) return entries.map((entry) => ({ key: entry.id, entry }))

  const found = findAnniversaries(entries, entries, Math.max(10, cols * 3))
  const byAnchor = new Map(found.map((a) => [a.anchorId, a]))
  const out: WallItem[] = []
  for (const entry of entries) {
    out.push({ key: entry.id, entry })
    const echo = byAnchor.get(entry.id)
    if (echo) {
      out.push({
        key: `echo:${entry.id}:${echo.entry.id}`,
        entry: echo.entry,
        echo: anniversaryLabel(echo),
      })
    }
  }
  return out
}

/**
 * The pages a selection may contain, in wall order.
 *
 * Echoes are excluded, and that exclusion is load-bearing. An echo is the same
 * entry appearing a second time, out of its own place; let it into this list and
 * one id occupies two indices. Then ⌘-clicking one instance lights both, and a
 * shift-range that crosses an echo produces a set whose size disagrees with the
 * number of highlighted cards on screen — the selection count says 7 and you can
 * count 8. Range selection is `indexOf`-based, so this list is the only thing
 * standing between the user and that.
 */
export function selectionOrder(items: WallItem[]): string[] {
  return items.filter((it) => !it.echo).map((it) => it.entry.id)
}

/**
 * First row index for each year — where the scrubber jumps to.
 *
 * Echoes are skipped: a page out of its own order must not claim a year, or the
 * scrubber sends you to 2019 and lands you in the middle of 2024.
 */
export function yearRows(items: WallItem[], cols: number): Map<string, number> {
  const map = new Map<string, number>()
  items.forEach((item, i) => {
    if (item.echo) return
    const y = String(new Date(item.entry.created_at).getFullYear())
    if (!map.has(y)) map.set(y, Math.floor(i / cols))
  })
  return map
}

export interface MonthMark {
  /** Row this month's first page falls in. */
  row: number
  /** "March 2019" — the label the gutter rule carries. */
  label: string
  month: number
  year: number
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * Where each month starts, as rows.
 *
 * Months cannot be rows in the flow — the windowing math needs every row the
 * same height, which is what lets a 3,500-page wall scroll cleanly. So they are
 * an overlay: a rule drawn in the gutter beside the row a month begins on,
 * taking no space and shifting nothing.
 *
 * One mark per month, at its FIRST page in wall order. Echoes are skipped for
 * the same reason they don't claim years.
 */
export function monthMarks(items: WallItem[], cols: number): MonthMark[] {
  const seen = new Set<string>()
  const out: MonthMark[] = []
  items.forEach((item, i) => {
    if (item.echo) return
    const d = new Date(item.entry.created_at)
    const year = d.getFullYear()
    const month = d.getMonth()
    const key = `${year}-${month}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ row: Math.floor(i / cols), label: `${MONTH_LABELS[month]} ${year}`, month, year })
  })
  return out
}

/** The month label for whatever is at the top of the viewport. */
export function monthAtRow(items: WallItem[], cols: number, row: number): string | null {
  const item = items[row * cols]
  if (!item) return null
  const d = new Date(item.entry.created_at)
  return `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
}
