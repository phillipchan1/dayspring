import { describe, expect, it } from 'vitest'
import { buildFacts, buildWeather, foldCopy, foldMonth } from './weather'

const d = (iso: string) => `${iso}T12:00:00Z`

describe('buildWeather', () => {
  it('is empty for no dates', () => {
    expect(buildWeather([])).toEqual({ years: [], cells: [], peak: 1, total: 0 })
  })

  it('buckets by year and month', () => {
    const w = buildWeather([d('2019-11-12'), d('2019-11-20'), d('2020-03-04')])
    expect(w.years).toEqual([2019, 2020])
    expect(w.cells[0]![10]).toBe(2)
    expect(w.cells[1]![2]).toBe(1)
    expect(w.total).toBe(3)
    expect(w.peak).toBe(2)
  })

  it('keeps empty years as rows so the span reads continuously', () => {
    const w = buildWeather([d('2019-01-01'), d('2023-01-01')])
    expect(w.years).toEqual([2019, 2020, 2021, 2022, 2023])
    expect(w.cells[1]!.every((n) => n === 0)).toBe(true)
  })

  it('uses UTC so a late-December entry cannot slide into the next year', () => {
    const w = buildWeather(['2019-12-31T23:30:00Z'])
    expect(w.years).toEqual([2019])
    expect(w.cells[0]![11]).toBe(1)
  })

  it('ignores unparseable dates', () => {
    expect(buildWeather(['not a date', d('2020-01-01')]).total).toBe(1)
  })

  it('reports a peak of at least 1 so callers can divide by it', () => {
    expect(buildWeather([]).peak).toBe(1)
  })
})

describe('foldMonth', () => {
  const w = buildWeather([
    d('2019-11-12'), d('2019-11-20'),
    d('2020-11-02'),
    d('2021-03-15'),
    d('2022-11-30'),
  ])

  it('counts a month across every year', () => {
    expect(foldMonth(w, 10)).toEqual({ month: 10, total: 4, years: 3, ofYears: 4 })
  })

  it('reports zero for a month that never appears', () => {
    expect(foldMonth(w, 6)).toMatchObject({ total: 0, years: 0 })
  })
})

describe('foldCopy', () => {
  const w = buildWeather([d('2019-11-12'), d('2020-11-02'), d('2021-03-15'), d('2022-11-30')])

  it('states the count and the spread, and nothing else', () => {
    expect(foldCopy(foldMonth(w, 10))).toBe('November: 3 passages, across 3 of 4 years.')
  })

  it('says nothing rather than nothing-yet when a month is empty', () => {
    expect(foldCopy(foldMonth(w, 6))).toBe('Nothing in any July, in 4 years.')
  })

  it('singularises', () => {
    expect(foldCopy(foldMonth(w, 2))).toBe('March: 1 passage, across 1 of 4 years.')
  })

  it('drops the across-clause when the span is a single year', () => {
    const one = buildWeather([d('2024-05-01'), d('2024-05-09')])
    expect(foldCopy(foldMonth(one, 4))).toBe('May: 2 passages.')
    expect(foldCopy(foldMonth(one, 0))).toBe('Nothing in January.')
  })

  it('takes a caller-supplied noun for the Ask view', () => {
    expect(foldCopy(foldMonth(w, 2), 'entry')).toContain('1 entry')
  })
})

describe('buildFacts', () => {
  it('is empty for no dates', () => {
    expect(buildFacts([])).toEqual({ count: 0, first: null, latest: null, longestSilence: 0 })
  })

  it('reports count, first, and most recent', () => {
    const f = buildFacts([d('2020-06-01'), d('2019-11-12'), d('2026-01-09')])
    expect(f.count).toBe(3)
    expect(f.first).toBe('Nov 2019')
    expect(f.latest).toBe('Jan 2026')
  })

  it('measures the longest silence between adjacent dates', () => {
    // Feb 2020 → Jun 2021 is 486 days; floored against the 30.44-day month the
    // server also uses (api/ask.ts longestGapMonths), that reads as 15.
    expect(buildFacts([d('2020-01-01'), d('2020-02-01'), d('2021-06-01')]).longestSilence).toBe(15)
  })

  it('rounds a silence down, never up — the number must not overstate', () => {
    expect(buildFacts([d('2020-01-01'), d('2020-02-25')]).longestSilence).toBe(1)
  })

  it('reports no silence for a single date', () => {
    expect(buildFacts([d('2020-01-01')]).longestSilence).toBe(0)
  })
})
