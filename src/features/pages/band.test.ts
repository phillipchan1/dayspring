import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { bandFor, cellLabel, inSpan, monthsAcross, spanFrom, spanLabel, spanText } from './band'

let n = 0
function entry(local: string): Entry {
  const [y, m, d] = local.split('-').map(Number)
  const iso = new Date(y!, (m ?? 1) - 1, d ?? 1, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: 'a page',
    title: null,
    mood: null,
    tags: [],
    word_count: 2,
    source: 'native',
    external_id: null,
  }
}

describe('monthsAcross', () => {
  it('runs from the first page in the archive to the last', () => {
    const months = monthsAcross([entry('2024-01-15'), entry('2024-04-02')])
    expect(months).toHaveLength(4)
    expect(months[0]).toEqual({ year: 2024, month: 0 })
    expect(months.at(-1)).toEqual({ year: 2024, month: 3 })
  })

  it('spans years without a gap', () => {
    expect(monthsAcross([entry('2023-11-01'), entry('2024-02-01')])).toHaveLength(4)
  })

  it('is empty rather than throwing on an empty archive', () => {
    expect(monthsAcross([])).toEqual([])
  })
})

describe('bandFor', () => {
  const months = monthsAcross([entry('2024-01-01'), entry('2024-03-01')])

  /*
   * A cell that carries nothing still exists. The months where a subject is
   * SILENT are half of what a band says — drop them and the band becomes a list
   * of the months it was busy, which is a different and much smaller claim.
   */
  it('keeps a cell for every month, including the silent ones', () => {
    const band = bandFor('c:mom', 'Mom', [entry('2024-01-05')], months)
    expect(band.cells).toHaveLength(3)
    expect(band.cells.filter((c) => c.pages === 0)).toHaveLength(2)
  })

  /*
   * NO VERTICAL AXIS. Warmth is a share of this subject's own busiest month —
   * never across subjects, because normalising a quiet subject against a loud
   * one renders "you write about her less than him", a comparison nobody asked
   * for and the app has no business making.
   */
  it('measures warmth against the subject own busiest month', () => {
    const band = bandFor(
      'c:mom',
      'Mom',
      [entry('2024-01-01'), entry('2024-01-02'), entry('2024-01-03'), entry('2024-02-01')],
      months,
    )
    expect(band.cells[0]!.warmth).toBe(1)
    expect(band.cells[1]!.warmth).toBeCloseTo(1 / 3)
    expect(band.cells[2]!.warmth).toBe(0)
  })

  it('gives a quiet subject the same full warmth in its own busiest month', () => {
    const loud = bandFor('a', 'A', [entry('2024-01-01'), entry('2024-01-02')], months)
    const quiet = bandFor('b', 'B', [entry('2024-01-01')], months)
    // Both peak at 1. The band never says one subject matters more.
    expect(loud.cells[0]!.warmth).toBe(1)
    expect(quiet.cells[0]!.warmth).toBe(1)
  })

  it('carries its own first and last page', () => {
    const band = bandFor('c:mom', 'Mom', [entry('2024-03-01'), entry('2024-01-01')], months)
    expect(new Date(band.first!).getMonth()).toBe(0)
    expect(new Date(band.last!).getMonth()).toBe(2)
  })

  it('says nothing rather than dividing by zero when a subject has no pages', () => {
    const band = bandFor('c:nobody', 'Nobody', [], months)
    expect(band.pages).toBe(0)
    expect(band.cells.every((c) => c.warmth === 0)).toBe(true)
  })

  // Several subjects give one band each, against the SAME months — the only way
  // two bands can be read against each other.
  it('lays every subject on the same timeline', () => {
    const a = bandFor('a', 'A', [entry('2024-01-01')], months)
    const b = bandFor('b', 'B', [entry('2024-03-01')], months)
    expect(a.cells.map((c) => `${c.year}-${c.month}`)).toEqual(
      b.cells.map((c) => `${c.year}-${c.month}`),
    )
  })
})

describe('labels', () => {
  it('says what a cell holds, in pages', () => {
    expect(cellLabel({ year: 2024, month: 7, pages: 3, warmth: 1 }, 'Mom')).toContain('3 pages')
    expect(cellLabel({ year: 2024, month: 7, pages: 1, warmth: 1 }, 'Mom')).toContain('1 page')
  })

  it('says a silent month is silent rather than showing a zero', () => {
    expect(cellLabel({ year: 2024, month: 7, pages: 0, warmth: 0 }, 'Mom')).toContain('nothing')
  })

  it('collapses a span inside one year', () => {
    expect(spanLabel(new Date(2024, 0, 1).toISOString(), new Date(2024, 6, 1).toISOString())).toBe('2024')
  })

  it('is empty rather than half a range when a subject has no pages', () => {
    expect(spanLabel(null, null)).toBe('')
  })
})

describe('spanFrom', () => {
  it('normalises a drag that ran backwards', () => {
    expect(spanFrom(9, 3, 20)).toEqual({ from: 3, to: 9 })
    expect(spanFrom(3, 9, 20)).toEqual({ from: 3, to: 9 })
  })

  it('holds the ends of the timeline', () => {
    expect(spanFrom(-4, 5, 20)).toEqual({ from: 0, to: 5 })
    expect(spanFrom(5, 99, 20)).toEqual({ from: 5, to: 19 })
  })

  it('takes a press with no travel as one month', () => {
    expect(spanFrom(7, 7, 20)).toEqual({ from: 7, to: 7 })
  })

  /*
   * Bracketing everything is the ABSENCE of a bracket, not a bracket around
   * everything — otherwise the surface has two states that look identical and
   * one of them has a clear button on it.
   */
  it('treats the whole archive as no bracket at all', () => {
    expect(spanFrom(0, 19, 20)).toBeNull()
    expect(spanFrom(19, 0, 20)).toBeNull()
    expect(spanFrom(0, 0, 0)).toBeNull()
  })
})

describe('inSpan', () => {
  const months = monthsAcross([
    { created_at: new Date(2019, 0, 5).toISOString() },
    { created_at: new Date(2019, 11, 5).toISOString() },
  ] as never)

  it('includes both ends of the bracket', () => {
    const span = { from: 2, to: 5 } // March–June 2019
    expect(inSpan(new Date(2019, 2, 1).toISOString(), span, months)).toBe(true)
    expect(inSpan(new Date(2019, 5, 28).toISOString(), span, months)).toBe(true)
    expect(inSpan(new Date(2019, 1, 28).toISOString(), span, months)).toBe(false)
    expect(inSpan(new Date(2019, 6, 1).toISOString(), span, months)).toBe(false)
  })

  // A bracket that cannot be resolved must not silently hide the archive.
  it('lets everything through when the bracket points nowhere', () => {
    expect(inSpan(new Date(2019, 2, 1).toISOString(), { from: 99, to: 120 }, months)).toBe(true)
  })
})

describe('spanText', () => {
  const months = monthsAcross([
    { created_at: new Date(2019, 0, 5).toISOString() },
    { created_at: new Date(2021, 5, 5).toISOString() },
  ] as never)

  it('names one month, and a stretch of them', () => {
    expect(spanText({ from: 0, to: 0 }, months)).toBe('January 2019')
    expect(spanText({ from: 10, to: 14 }, months)).toBe('November 2019 – March 2020')
  })
})
