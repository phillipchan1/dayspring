// What the wall lays out, and what a selection is allowed to contain.
//
// Pulled out of PageWall because these two lists disagreeing is the surface's
// sharpest failure mode, and disagreement is invisible in a component.

import type { Entry } from '@/lib/types'
import { anniversaryLabel, findAnniversaries } from './anniversaries'

export interface WallItem {
  /** React key. Carries the anchor for echoes, because an id can repeat. */
  key: string
  /** For a seam, the first page of the run it stands for. */
  entry: Entry
  /** Set when this page has risen out of an earlier year. */
  echo?: string
  /** Set when this cell stands in for a run of pages the filter passed over. */
  seam?: { count: number; fromIso: string; toIso: string }
}

/**
 * Every card on the wall, in order.
 *
 * @param cols  Column count used by the default echo cadence.
 * @param minEchoGap  Optional page-count cadence for a rendering that knows
 *                    how many pages its viewport holds.
 */
export function buildWallItems(
  entries: Entry[],
  echoes: boolean,
  cols: number,
  minEchoGap?: number,
): WallItem[] {
  if (!echoes) return entries.map((entry) => ({ key: entry.id, entry }))

  // The present is the orientation anchor. An earlier-year page should never
  // interrupt the current-week cluster; begin looking for anchors only after
  // the reader has crossed out of it.
  const anchors = entries.filter(
    (entry) => !isCurrentCalendarWeek(entry.created_at),
  )
  const found = findAnniversaries(
    anchors,
    entries,
    minEchoGap ?? Math.max(10, cols * 3),
  )
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
 * Whether a page belongs to the reader's current Monday–Sunday week.
 *
 * Local dates are deliberate: the page date and "this week" are both things
 * the reader experiences in their own calendar, not UTC reporting periods.
 */
export function isCurrentCalendarWeek(iso: string, now = new Date()): boolean {
  const page = new Date(iso)
  if (Number.isNaN(page.getTime()) || Number.isNaN(now.getTime())) return false

  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const daysSinceMonday = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - daysSinceMonday)

  const next = new Date(start)
  next.setDate(start.getDate() + 7)
  return page >= start && page < next
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
  return items.filter((it) => !it.echo && !it.seam).map((it) => it.entry.id)
}

/**
 * Fold runs of unlit pages into a seam.
 *
 * The problem this solves is the one you only meet on a real archive: a filter
 * that matches thirty pages across eleven years leaves you scrolling through
 * hundreds of dimmed ones to get from one hit to the next. Dimming was right —
 * the pages that don't carry a word are what give the ones that do their shape —
 * but "shape" stops being legible at four screens of it.
 *
 * A seam keeps the fact of them (how many, and across what span) while giving
 * back the space. Clicking one puts its pages back, in place.
 *
 * Deliberately one CELL, not a full-width rule between rows. A rule reads
 * better, and costs a whole row of height per seam — which on a sparse filter
 * is exactly the scrolling this exists to remove. The seam sits inline among
 * the pages, so a run of 200 collapses to the width of one.
 *
 * @param minRun  Runs shorter than this stay as pages. Collapsing two dimmed
 *                cards saves nothing and costs you the rhythm of the archive.
 */
export function collapseUnlit(
  items: WallItem[],
  lit: Set<string> | null,
  expanded: ReadonlySet<string> = new Set(),
  minRun = 4,
): WallItem[] {
  if (!lit) return items

  const out: WallItem[] = []
  let run: WallItem[] = []

  const flush = () => {
    if (run.length === 0) return
    const first = run[0]!
    const last = run[run.length - 1]!
    const key = `seam:${first.key}:${run.length}`
    if (run.length < minRun || expanded.has(key)) out.push(...run)
    else {
      out.push({
        key,
        entry: first.entry,
        seam: {
          count: run.length,
          // Wall order is newest first, so the run's LAST page is its earliest.
          fromIso: last.entry.created_at,
          toIso: first.entry.created_at,
        },
      })
    }
    run = []
  }

  for (const item of items) {
    // An echo is a page from elsewhere in the wall; it rode in beside a page
    // that may itself be hidden, so it folds with the run rather than breaking it.
    if (lit.has(item.entry.id) && !item.echo) {
      flush()
      out.push(item)
    } else {
      run.push(item)
    }
  }
  flush()
  return out
}

/** How a seam says what it is holding. */
export function seamLabel(count: number, fromIso: string, toIso: string): string {
  const span = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  const from = span(fromIso)
  const to = span(toIso)
  const pages = `${count} ${count === 1 ? 'page' : 'pages'}`
  return from === to ? `${pages} · ${from}` : `${pages} · ${from} – ${to}`
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
