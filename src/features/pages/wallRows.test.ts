import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import type { WallItem } from './wallItems'
import {
  buildWallRows,
  chooseGrain,
  firstItemIndexAtRow,
  itemIndexByRowOffset,
  visibleItemCount,
} from './wallRows'

let n = 0
function entry(dateLocal: string): Entry {
  const [year, month, day] = dateLocal.split('-').map(Number)
  const iso = new Date(year!, month! - 1, day!, 12).toISOString()
  return {
    id: `row-${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: dateLocal,
    title: null,
    mood: null,
    tags: [],
    word_count: 1,
    source: 'native',
    external_id: null,
  }
}

const item = (date: string): WallItem => {
  const e = entry(date)
  return { key: e.id, entry: e }
}

describe('buildWallRows', () => {
  it('keeps a cross-month current week in one section', () => {
    const layout = buildWallRows(
      [item('2026-09-01'), item('2026-08-31'), item('2026-08-30')],
      2,
      new Date(2026, 8, 1, 12),
    )
    expect(layout.rows.map((row) => row.period.label)).toEqual([
      'This week',
      'This week',
      'August 2026',
      'August 2026',
    ])
    expect(layout.rows[1]?.kind === 'items' && layout.rows[1].cells).toHaveLength(2)
  })

  /*
   * A period can open twice — "this week" cuts a month in half — and two rows
   * sharing a React key left a header stranded in the DOM with no fiber parent.
   */
  it('gives every row a key of its own, even when a period opens twice', () => {
    const layout = buildWallRows(
      [item('2026-09-27'), item('2026-09-08'), item('2026-09-02')],
      1,
      new Date(2026, 8, 8, 12),
    )
    expect(layout.rows.map((row) => row.period.label)).toEqual([
      'September 2026', 'September 2026',
      'This week', 'This week',
      'September 2026', 'September 2026',
    ])
    const keys = layout.rows.map((row) => row.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('never mixes two months in one page row', () => {
    const layout = buildWallRows(
      [item('2024-06-03'), item('2024-06-02'), item('2024-06-01'), item('2024-05-31')],
      2,
      new Date(2026, 8, 1, 12),
    )
    const pageRows = layout.rows.filter((row) => row.kind === 'items')
    expect(pageRows.map((row) => row.cells.map((cell) => cell.item.entry.created_at))).toEqual([
      expect.arrayContaining([expect.stringContaining('2024-06-03'), expect.stringContaining('2024-06-02')]),
      [expect.stringContaining('2024-06-01')],
      [expect.stringContaining('2024-05-31')],
    ])
  })

  it('keeps a recall in its anchor month', () => {
    const anchor = item('2026-08-30')
    const historical = entry('2011-08-27')
    const echo: WallItem = {
      key: `echo:${historical.id}`,
      entry: historical,
      echo: '15 years earlier · the same week',
    }
    const layout = buildWallRows(
      [anchor, echo, item('2026-08-29')],
      2,
      new Date(2026, 8, 1, 12),
    )
    expect(layout.rows.every((row) => row.period.label === 'August 2026')).toBe(true)
  })

  it('uses a seam’s newest hidden page as its section when nothing follows it', () => {
    const hidden = entry('2024-03-20')
    const seam: WallItem = {
      key: 'seam:march',
      entry: hidden,
      seam: {
        count: 20,
        fromIso: entry('2024-01-02').created_at,
        toIso: hidden.created_at,
      },
    }
    const layout = buildWallRows([seam], 2, new Date(2026, 8, 1, 12))
    expect(layout.rows[0]?.period.label).toBe('March 2024')
  })

  it('maps item positions across header rows for scrolling and focus', () => {
    const layout = buildWallRows(
      [item('2024-06-03'), item('2024-06-02'), item('2024-05-31'), item('2024-05-30')],
      2,
      new Date(2026, 8, 1, 12),
    )
    expect(layout.itemPositions).toEqual([
      { row: 1, col: 0 },
      { row: 1, col: 1 },
      { row: 3, col: 0 },
      { row: 3, col: 1 },
    ])
    expect(firstItemIndexAtRow(layout, 2)).toBe(2)
    expect(itemIndexByRowOffset(layout, 0, 1)).toBe(2)
    expect(visibleItemCount(layout, 0, 4)).toBe(4)
    expect(layout.yearRows.get('2024')).toBe(0)
  })
})

/*
 * A seam is the gap BETWEEN two answers. Drawn as a cell it means one answer per
 * row on a sparse filter, which is the scrolling the seam exists to remove.
 */
describe('folding a seam onto the page it precedes', () => {
  const seamBefore = (key: string, count: number, from: string, to: string): WallItem => ({
    key,
    entry: entry(to),
    seam: { count, fromIso: entry(from).created_at, toIso: entry(to).created_at },
  })

  it('costs no cell, so answers still pack the row', () => {
    const layout = buildWallRows(
      [
        seamBefore('seam:a', 20, '2024-06-01', '2024-06-20'),
        item('2024-06-30'),
        seamBefore('seam:b', 86, '2024-06-02', '2024-06-21'),
        item('2024-06-29'),
      ],
      2,
      new Date(2026, 8, 1, 12),
    )
    const pageRows = layout.rows.filter((row) => row.kind === 'items')
    expect(pageRows).toHaveLength(1)
    const cells = pageRows[0]!.kind === 'items' ? pageRows[0]!.cells : []
    expect(cells.map((cell) => cell.fold?.item.seam?.count)).toEqual([20, 86])
    // Density is answers, not the gaps between them.
    expect(visibleItemCount(layout, 0, layout.rows.length)).toBe(2)
  })

  it('gives the fold its host’s position, so arrow keys still reach it', () => {
    const layout = buildWallRows(
      [seamBefore('seam:a', 20, '2024-06-01', '2024-06-20'), item('2024-06-30')],
      2,
      new Date(2026, 8, 1, 12),
    )
    expect(layout.itemPositions[0]).toEqual(layout.itemPositions[1])
  })

  it('never lets a fold open a section its host does not belong to', () => {
    // The run reaches back into 2019; the page it rides on is a 2024 page.
    const layout = buildWallRows(
      [seamBefore('seam:old', 300, '2019-02-02', '2019-11-30'), item('2024-06-30')],
      2,
      new Date(2026, 8, 1, 12),
    )
    expect(layout.rows.map((row) => row.period.label)).toEqual(['June 2024', 'June 2024'])
  })
})

describe('chooseGrain', () => {
  const months = (count: number, perMonth: number): WallItem[] =>
    Array.from({ length: count }, (_, m) =>
      Array.from({ length: perMonth }, (_, d) =>
        item(`20${String(10 + Math.floor(m / 12)).padStart(2, '0')}-${String((m % 12) + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`),
      ),
    ).flat()

  it('keeps months while browsing the whole archive', () => {
    // 24 months carrying 16 pages each: the headings are a rounding error.
    expect(chooseGrain(months(24, 16))).toBe('month')
  })

  /*
   * The case this exists for. Forty pages that say one name are spread over
   * eleven years, so month headings outnumber the pages they introduce and the
   * wall becomes a list of month names — measured at 12 screens for 137 answers.
   */
  it('coarsens to years once headings would outweigh the pages', () => {
    expect(chooseGrain(months(40, 1))).toBe('year')
  })

  it('stays on months for a short archive, where one year heading says nothing', () => {
    expect(chooseGrain(months(6, 1))).toBe('month')
  })

  it('does not count seams as pages when weighing the grain', () => {
    const sparse = months(40, 1)
    const withSeams = sparse.flatMap((page, i) => [
      { key: `seam:${i}`, entry: page.entry, seam: { count: 9, fromIso: page.entry.created_at, toIso: page.entry.created_at } } as WallItem,
      page,
    ])
    expect(chooseGrain(withSeams)).toBe('year')
  })

  it('drops the current-week heading at year grain rather than splitting a year', () => {
    const layout = buildWallRows(
      [item('2026-09-01'), item('2026-08-31')],
      2,
      new Date(2026, 8, 1, 12),
      'year',
    )
    expect(layout.rows.map((row) => row.period.label)).toEqual(['2026', '2026'])
  })
})
