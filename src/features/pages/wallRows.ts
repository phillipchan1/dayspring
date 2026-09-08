import type { WallItem } from './wallItems'
import { isCurrentCalendarWeek } from './wallItems'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/**
 * How coarsely the archive names its sections.
 *
 * Not a preference and not a mode — see `chooseGrain`. The wall picks the grain
 * that keeps its headers smaller than what they introduce.
 */
export type SectionGrain = 'month' | 'year'

export interface WallPeriod {
  key: string
  label: string
  year: number
  month: number
  currentWeek: boolean
}

export interface WallRowCell {
  item: WallItem
  itemIndex: number
  col: number
  /**
   * A run the filter passed over, riding on this cell's leading edge.
   *
   * A seam is the gap BETWEEN two answers, not an answer — so it is drawn as a
   * mark on the page that follows it rather than as a cell of its own. It keeps
   * its own item index, so arrow keys still land on it and Enter still opens it.
   */
  fold?: { item: WallItem; itemIndex: number }
}

export type WallLayoutRow =
  | { kind: 'section'; key: string; period: WallPeriod }
  | { kind: 'items'; key: string; period: WallPeriod; cells: WallRowCell[] }

export interface WallRowLayout {
  rows: WallLayoutRow[]
  itemPositions: Array<{ row: number; col: number }>
  yearRows: Map<string, number>
  grain: SectionGrain
}

function periodForIso(iso: string, now: Date, grain: SectionGrain): WallPeriod {
  const date = new Date(iso)
  const year = date.getFullYear()
  const month = date.getMonth()

  if (grain === 'year') {
    // No "This week" at this grain. A current-week section inside a year would
    // split it into 2026 · This week · 2026, and the year grain is only ever
    // chosen when the wall is too thin for month headings to earn their rows —
    // which is exactly when a third heading helps least. The pages themselves
    // still carry the week's wash.
    return { key: `y${year}`, label: String(year), year, month, currentWeek: false }
  }

  if (isCurrentCalendarWeek(iso, now)) {
    return {
      key: 'current-week',
      label: 'This week',
      year,
      month,
      currentWeek: true,
    }
  }
  return {
    key: `${year}-${month}`,
    label: `${MONTHS[month]} ${year}`,
    year,
    month,
    currentWeek: false,
  }
}

/**
 * The grain at which sections stop paying for themselves.
 *
 * A header costs exactly one row — that is the price of keeping every row the
 * same height, which is what lets a 3,500-page wall window at all. Browsing the
 * whole archive that price is nothing: a hundred and twenty months introduce a
 * thousand rows of pages. Under a sparse filter it inverts. Forty pages that say
 * one name are spread across eleven years, so nearly every month contributes a
 * heading and one page, and the wall becomes a list of month names with pages
 * between them — measured at 12 screens for 137 answers, two thirds of it
 * headings.
 *
 * So the grain follows the density of what is actually shown: a month heading
 * earns its row when the month it introduces holds more than a couple of pages.
 * Below that the wall is mostly headings, and years say the same thing for a
 * tenth of the height.
 *
 * Measured in PAGES PER MONTH rather than in rows, deliberately, even though
 * rows are what the reader scrolls. Rows depend on the column count, so a
 * row-based rule changes the grain when the window is resized — and the wall
 * mounts at one column before it measures itself, so every load would relayout
 * from months to years. That flip is what stranded a header in the DOM (see
 * `open`), and a rule that cannot flip cannot strand one.
 *
 * The `> 12` floor keeps a short archive — or a bracketed era — on months, where
 * a year heading would be one heading for the whole wall and say nothing.
 */
export function chooseGrain(items: WallItem[]): SectionGrain {
  let pages = 0
  const months = new Set<string>()
  for (const item of items) {
    if (item.seam) continue
    pages += 1
    if (item.echo) continue
    const date = new Date(item.entry.created_at)
    months.add(`${date.getFullYear()}-${date.getMonth()}`)
  }
  return months.size > 12 && pages / months.size < 3 ? 'year' : 'month'
}

/**
 * Compose the dense wall into fixed-height visual rows.
 *
 * Headers consume the same height as page rows, so the existing uniform
 * virtualizer remains exact. Echoes inherit their anchor's period: their own
 * historical date explains the recall, but must not reorganize the present.
 *
 * Seams consume no row at all — they fold onto the page that follows them. See
 * `WallRowCell.fold`.
 */
export function buildWallRows(
  items: WallItem[],
  cols: number,
  now = new Date(),
  grain: SectionGrain = 'month',
): WallRowLayout {
  const safeCols = Math.max(1, Math.floor(cols))
  const rows: WallLayoutRow[] = []
  const itemPositions: Array<{ row: number; col: number }> = []
  const yearRows = new Map<string, number>()
  let period: WallPeriod | null = null
  let pending: WallRowCell[] = []
  let held: { item: WallItem; itemIndex: number } | null = null

  const flush = () => {
    if (!period || pending.length === 0) return
    const row = rows.length
    for (const cell of pending) {
      itemPositions[cell.itemIndex] = { row, col: cell.col }
      // A fold shares the cell it rides on, so arrowing onto it scrolls to the
      // same row the reader can already see it in.
      if (cell.fold) itemPositions[cell.fold.itemIndex] = { row, col: cell.col }
    }
    // Keyed by row index for the same reason `open` is: a period can open more
    // than once, and a counter that restarts with it mints the same key twice.
    rows.push({
      kind: 'items',
      key: `pages:${period.key}:${row}`,
      period,
      cells: pending,
    })
    pending = []
  }

  const open = (next: WallPeriod) => {
    flush()
    period = next
    const row = rows.length
    /*
     * The row index is in the key because a PERIOD CAN OPEN TWICE.
     *
     * "This week" cuts across whatever month it falls in, so a page dated later
     * in that month than the week itself leaves September · This week ·
     * September — two headers, one period key. Keyed on the period alone that
     * is a duplicate React key, and React's documented response to a duplicate
     * is to duplicate or omit: the observed result was a header stranded in the
     * DOM with no fiber parent, still on screen and no longer re-rendered, so
     * it survived the next relayout and sat above the wall labelling a month
     * that was no longer there.
     */
    rows.push({ kind: 'section', key: `section:${next.key}:${row}`, period: next })
    const year = String(next.year)
    if (!yearRows.has(year)) yearRows.set(year, row)
  }

  const place = (item: WallItem, itemIndex: number, iso: string) => {
    // A recall is inserted immediately after its anchor and belongs to that
    // anchor's section. Its own date explains the recall; it must not open a
    // section eleven years up the wall.
    const next = item.echo && period ? period : periodForIso(iso, now, grain)
    if (!period || next.key !== period.key) open(next)
    pending.push({
      item,
      itemIndex,
      col: pending.length,
      ...(held ? { fold: held } : {}),
    })
    held = null
    if (pending.length === safeCols) flush()
  }

  items.forEach((item, itemIndex) => {
    if (item.seam) {
      held = { item, itemIndex }
      return
    }
    place(item, itemIndex, item.entry.created_at)
  })

  // A run with no answer after it is not between anything — it is the bottom of
  // the archive — so it stands on its own rather than folding onto a page that
  // does not exist. Its section is its newest hidden page.
  if (held) {
    const trailing: { item: WallItem; itemIndex: number } = held
    held = null
    place(
      trailing.item,
      trailing.itemIndex,
      trailing.item.seam?.toIso ?? trailing.item.entry.created_at,
    )
  }
  flush()

  return { rows, itemPositions, yearRows, grain }
}

/** First real wall item at or after a visual row (headers are not items). */
export function firstItemIndexAtRow(
  layout: WallRowLayout,
  row: number,
): number | null {
  for (let i = Math.max(0, row); i < layout.rows.length; i++) {
    const candidate = layout.rows[i]
    if (candidate?.kind === 'items') return candidate.cells[0]?.itemIndex ?? null
  }
  return null
}

/** Move vertically while preserving the item's lane and skipping headers. */
export function itemIndexByRowOffset(
  layout: WallRowLayout,
  itemIndex: number,
  deltaRows: number,
): number {
  const position = layout.itemPositions[itemIndex]
  if (!position || deltaRows === 0) return itemIndex
  const direction = deltaRows < 0 ? -1 : 1
  let row = Math.max(
    0,
    Math.min(layout.rows.length - 1, position.row + deltaRows),
  )

  while (row >= 0 && row < layout.rows.length) {
    const candidate = layout.rows[row]
    if (candidate?.kind === 'items' && candidate.cells.length > 0) {
      return candidate.cells[Math.min(position.col, candidate.cells.length - 1)]!.itemIndex
    }
    row += direction
  }

  return direction > 0
    ? layout.itemPositions.length - 1
    : 0
}

export function visibleItemCount(
  layout: WallRowLayout,
  startRow: number,
  rowCount: number,
): number {
  return layout.rows
    .slice(Math.max(0, startRow), Math.max(0, startRow) + Math.max(0, rowCount))
    .reduce((count, row) => count + (row.kind === 'items' ? row.cells.length : 0), 0)
}
