import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { buildWallItems, monthAtRow, monthMarks, selectionOrder, yearRows } from './wallItems'

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
