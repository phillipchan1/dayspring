import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import {
  buildWallItems,
  collapseUnlit,
  isCurrentCalendarWeek,
  monthAtRow,
  monthMarks,
  seamLabel,
  selectionOrder,
  yearRows,
} from './wallItems'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

let n = 0
function entry(dateLocal: string): Entry {
  const [y, m, d] = dateLocal.split('-').map(Number)
  const iso = new Date(y!, m! - 1, d!, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: `something written on ${dateLocal}, long enough to be a real page`,
    title: null,
    mood: null,
    tags: [],
    word_count: 12,
    source: 'native',
    external_id: null,
  }
}

/**
 * A corpus dense enough to earn echoes: several years, all clustered on the same
 * week of June, and enough pages per month to clear MIN_MONTH_DENSITY.
 */
function corpus(): Entry[] {
  const out: Entry[] = []
  for (const year of [2024, 2023, 2022, 2021]) {
    for (const day of [12, 11, 10, 9, 8]) out.push(entry(`${year}-06-${day}`))
  }
  return out
}

describe('buildWallItems', () => {
  it('is exactly the entries when echoes are off', () => {
    const entries = corpus()
    const items = buildWallItems(entries, false, 4)
    expect(items).toHaveLength(entries.length)
    expect(items.every((i) => !i.echo)).toBe(true)
  })

  it('gives every card a distinct React key even when an entry repeats', () => {
    const items = buildWallItems(corpus(), true, 4)
    expect(new Set(items.map((i) => i.key)).size).toBe(items.length)
  })

  it('accepts a viewport-sized recall cadence', () => {
    const items = buildWallItems(corpus(), true, 2, 52)
    expect(items.filter((item) => item.echo)).toHaveLength(1)
  })

  it('does not let a recall interrupt the current-week cluster', () => {
    const today = new Date()
    const current = entry(
      [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, '0'),
        String(today.getDate()).padStart(2, '0'),
      ].join('-'),
    )
    const entries = [
      current,
      entry('2024-06-10'),
      entry('2024-06-09'),
      entry('2023-06-10'),
      entry('2023-06-09'),
    ]
    const items = buildWallItems(entries, true, 2, 1)
    expect(items[0]!.entry.id).toBe(current.id)
    expect(items[1]!.echo).toBeUndefined()
    expect(items.some((item) => item.echo)).toBe(true)
  })
})

describe('isCurrentCalendarWeek', () => {
  const now = new Date(2026, 8, 1, 12)
  const iso = (year: number, month: number, day: number) =>
    new Date(year, month, day, 12).toISOString()

  it('uses a local Monday–Sunday week across a month boundary', () => {
    expect(isCurrentCalendarWeek(iso(2026, 7, 31), now)).toBe(true)
    expect(isCurrentCalendarWeek(iso(2026, 8, 6), now)).toBe(true)
    expect(isCurrentCalendarWeek(iso(2026, 7, 30), now)).toBe(false)
    expect(isCurrentCalendarWeek(iso(2026, 8, 7), now)).toBe(false)
  })

  it('is silent for an invalid date', () => {
    expect(isCurrentCalendarWeek('not-a-date', now)).toBe(false)
  })
})

describe('selectionOrder', () => {
  it('holds each entry exactly once, however many times it appears', () => {
    const items = buildWallItems(corpus(), true, 4)
    const ids = selectionOrder(items)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('never contains an echo', () => {
    const items = buildWallItems(corpus(), true, 4)
    const ids = new Set(selectionOrder(items))
    for (const item of items) {
      if (item.echo) continue
      expect(ids.has(item.entry.id)).toBe(true)
    }
    expect(selectionOrder(items)).toHaveLength(items.filter((i) => !i.echo).length)
  })

  /**
   * The reason the two lists are separate at all.
   *
   * Range select is `indexOf`-based. If an echoed entry occupied two indices,
   * a range that spanned it would return a set whose size disagreed with the
   * number of highlighted cards — the bar says 7 and you can count 8.
   */
  it('makes a range across an echo agree with itself', () => {
    const items = buildWallItems(corpus(), true, 4)
    const echoAt = items.findIndex((i) => i.echo)
    // If the fixture ever stops producing an echo this test proves nothing.
    expect(echoAt).toBeGreaterThan(-1)

    const ids = selectionOrder(items)
    const lo = ids.indexOf(items[echoAt - 1]!.entry.id)
    const hi = ids.length - 1
    const range = ids.slice(lo, hi + 1)
    expect(new Set(range).size).toBe(range.length)
  })

  it('keeps wall order, so a range means what the eye means', () => {
    const entries = corpus()
    const ids = selectionOrder(buildWallItems(entries, true, 4))
    expect(ids).toEqual(entries.map((e) => e.id))
  })
})

describe('yearRows', () => {
  const cols = 4
  const yearOf = (iso: string) => String(new Date(iso).getFullYear())

  // Not "the row starts with that year" — a year boundary falls wherever it
  // falls, and the row that begins 2023 can open with the last two pages of
  // 2024. What has to hold is that the year's first page is in view.
  it('lands on the row holding that year’s first page', () => {
    const items = buildWallItems(corpus(), true, cols)
    for (const [year, row] of yearRows(items, cols)) {
      const inRow = items.slice(row * cols, row * cols + cols)
      expect(inRow.some((i) => !i.echo && yearOf(i.entry.created_at) === year)).toBe(true)
    }
  })

  it('never lets an echo claim a year', () => {
    // An echo is a page out of its own order. If it could claim a year, the
    // scrubber would offer 2019 and drop you in the middle of 2024.
    const items = buildWallItems(corpus(), true, cols)
    const rows = yearRows(items, cols)
    for (const [year, row] of rows) {
      const firstOfYear = items.find((i) => !i.echo && yearOf(i.entry.created_at) === year)
      expect(firstOfYear).toBeDefined()
      expect(Math.floor(items.indexOf(firstOfYear!) / cols)).toBe(row)
    }
  })
})

describe('monthMarks', () => {
  const cols = 4

  it('marks each month once, at its first page', () => {
    const entries = [
      entry('2024-03-20'),
      entry('2024-03-04'),
      entry('2024-02-28'),
      entry('2024-02-01'),
      entry('2024-01-15'),
    ]
    const marks = monthMarks(buildWallItems(entries, false, cols), cols)
    expect(marks.map((m) => m.label)).toEqual(['March 2024', 'February 2024', 'January 2024'])
    expect(marks[0]!.row).toBe(0)
    expect(marks[1]!.row).toBe(0) // same row — the rule sits beside the row, not on a page
    expect(marks[2]!.row).toBe(1)
  })

  it('separates the same month in different years', () => {
    const marks = monthMarks(
      buildWallItems([entry('2024-06-02'), entry('2023-06-02')], false, cols),
      cols,
    )
    expect(marks.map((m) => m.label)).toEqual(['June 2024', 'June 2023'])
  })

  // An echo is a page out of its own order; letting one open a month would draw
  // "August 2016" beside a row of 2026 pages.
  it('never lets an echo open a month', () => {
    const items = buildWallItems(corpus(), true, cols)
    expect(items.some((i) => i.echo)).toBe(true)
    for (const m of monthMarks(items, cols)) {
      const inRow = items.slice(m.row * cols, m.row * cols + cols)
      expect(inRow.some((i) => !i.echo && `${MONTHS[new Date(i.entry.created_at).getMonth()]} ${new Date(i.entry.created_at).getFullYear()}` === m.label)).toBe(true)
    }
  })
})

describe('monthAtRow', () => {
  it('reads the month of whatever is at the top of the viewport', () => {
    const entries = [entry('2024-03-20'), entry('2024-03-04'), entry('2024-01-15')]
    const items = buildWallItems(entries, false, 2)
    expect(monthAtRow(items, 2, 0)).toBe('March 2024')
    expect(monthAtRow(items, 2, 1)).toBe('January 2024')
  })

  it('is silent past the end rather than throwing', () => {
    expect(monthAtRow(buildWallItems([entry('2024-03-20')], false, 4), 4, 99)).toBeNull()
  })
})

describe('collapseUnlit', () => {
  const wall = (n: number) =>
    buildWallItems(
      Array.from({ length: n }, (_, i) => entry(`2024-06-${String((i % 28) + 1).padStart(2, '0')}`)),
      false,
      4,
    )

  it('leaves the wall alone when nothing is lit', () => {
    const items = wall(20)
    expect(collapseUnlit(items, null)).toBe(items)
  })

  it('folds a long run of unlit pages into one cell', () => {
    const items = wall(20)
    const lit = new Set([items[0]!.entry.id, items[19]!.entry.id])
    const out = collapseUnlit(items, lit)
    expect(out).toHaveLength(3) // hit · seam · hit
    expect(out[1]!.seam?.count).toBe(18)
  })

  // Collapsing two dimmed cards saves nothing and costs the rhythm of the archive.
  it('leaves a short run as pages', () => {
    const items = wall(6)
    const lit = new Set([items[0]!.entry.id, items[3]!.entry.id])
    const out = collapseUnlit(items, lit)
    expect(out.every((i) => !i.seam)).toBe(true)
  })

  it('puts a run back when its seam is expanded', () => {
    const items = wall(20)
    const lit = new Set([items[0]!.entry.id])
    const folded = collapseUnlit(items, lit)
    const seam = folded.find((i) => i.seam)!
    expect(collapseUnlit(items, lit, new Set([seam.key]))).toHaveLength(items.length)
  })

  // A seam is not a page, and range selection is indexOf-based over ids — one
  // standing in for 200 entries must never be selectable as if it were one.
  it('never lets a seam into the selection order', () => {
    const items = wall(30)
    const lit = new Set([items[0]!.entry.id])
    const out = collapseUnlit(items, lit)
    expect(out.some((i) => i.seam)).toBe(true)
    expect(selectionOrder(out)).toEqual([items[0]!.entry.id])
  })

  it('reports the span it is holding, oldest first', () => {
    const entries = [entry('2024-06-10'), entry('2020-03-04'), entry('2019-01-02'), entry('2018-05-05')]
    const items = buildWallItems(entries, false, 4)
    const out = collapseUnlit(items, new Set([entries[0]!.id]), new Set(), 3)
    const seam = out.find((i) => i.seam)!.seam!
    expect(new Date(seam.fromIso).getFullYear()).toBe(2018)
    expect(new Date(seam.toIso).getFullYear()).toBe(2020)
  })
})

describe('seamLabel', () => {
  const iso = (y: number, m: number) => new Date(y, m, 10, 12).toISOString()

  it('reads as a span when the run crosses months', () => {
    expect(seamLabel(47, iso(2019, 2), iso(2019, 10))).toMatch(/47 pages · \w+ 2019 – \w+ 2019/)
  })

  it('collapses to one month when that is all it covers', () => {
    const label = seamLabel(5, iso(2019, 2), iso(2019, 2))
    expect(label).not.toContain('–')
    expect(label).toContain('5 pages')
  })

  it('says page, not pages, for one', () => {
    expect(seamLabel(1, iso(2019, 2), iso(2019, 2))).toContain('1 page ')
  })
})
