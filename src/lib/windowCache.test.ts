import { beforeEach, describe, expect, it } from 'vitest'
import {
  CacheOwnerChangedError,
  assertSameOwner,
  cacheGeneration,
  clearAllCache,
  onCacheCleared,
  setCache,
  windowCacheKey,
} from './asyncCache'
import {
  parseWindowKey,
  readWindowCache,
  unionWindows,
  windowContains,
  writeWindowCache,
  type CacheWindow,
} from './windowCache'

const d = (iso: string) => new Date(iso)

interface Row {
  at: string
}
const dateOf = (r: Row) => r.at
const PREFIX = 'test:rows:'

describe('windowContains', () => {
  const jan = { from: d('2026-01-01T00:00:00Z'), to: d('2026-01-31T23:59:59Z') }
  const year = { from: d('2026-01-01T00:00:00Z'), to: d('2026-12-31T23:59:59Z') }

  it('a wider window contains a narrower one', () => {
    expect(windowContains(year, jan)).toBe(true)
    expect(windowContains(jan, year)).toBe(false)
  })

  it('treats an absent bound as unbounded', () => {
    expect(windowContains({}, jan)).toBe(true)
    expect(windowContains({ from: d('2026-01-01T00:00:00Z') }, jan)).toBe(true)
    expect(windowContains({ to: d('2026-12-31T00:00:00Z') }, jan)).toBe(true)
  })

  it('does not let a bounded window cover an unbounded side', () => {
    expect(windowContains(year, {})).toBe(false)
    expect(windowContains(year, { from: d('2026-02-01T00:00:00Z') })).toBe(false)
    expect(windowContains(year, { to: d('2026-02-01T00:00:00Z') })).toBe(false)
  })

  it('is inclusive at the edges — an identical window contains itself', () => {
    expect(windowContains(jan, jan)).toBe(true)
  })

  it('rejects a window that overhangs by a moment', () => {
    expect(windowContains(jan, { ...jan, from: d('2025-12-31T23:59:59Z') })).toBe(false)
    expect(windowContains(jan, { ...jan, to: d('2026-02-01T00:00:00Z') })).toBe(false)
  })
})

describe('parseWindowKey', () => {
  it('round-trips the keys windowCacheKey writes', () => {
    const cases: CacheWindow[] = [
      {},
      { from: d('2026-01-01T00:00:00Z') },
      { to: d('2026-06-30T00:00:00Z') },
      { from: d('2026-01-01T00:00:00Z'), to: d('2026-12-31T23:59:59Z') },
    ]
    for (const w of cases) {
      const parsed = parseWindowKey(windowCacheKey(w))
      expect(parsed).not.toBeNull()
      expect(parsed!.from?.toISOString()).toBe(w.from?.toISOString())
      expect(parsed!.to?.toISOString()).toBe(w.to?.toISOString())
    }
  })

  it('returns null for a key it did not write', () => {
    expect(parseWindowKey('altar:field')).toBeNull()
    expect(parseWindowKey('nonsense|also-nonsense')).toBeNull()
  })
})

describe('unionWindows', () => {
  it('spans from the earliest start to the latest end', () => {
    const u = unionWindows([
      { from: d('2026-03-01T00:00:00Z'), to: d('2026-03-31T00:00:00Z') },
      { from: d('2026-01-01T00:00:00Z'), to: d('2026-01-31T00:00:00Z') },
    ])
    expect(u.from?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(u.to?.toISOString()).toBe('2026-03-31T00:00:00.000Z')
  })

  it('covers each input window', () => {
    const windows = [
      { from: d('2026-08-10T00:00:00Z'), to: d('2026-08-16T23:59:59Z') }, // trailing week
      { from: d('2026-08-01T00:00:00Z'), to: d('2026-08-31T23:59:59Z') }, // month
      { from: d('2026-07-01T00:00:00Z'), to: d('2026-09-30T23:59:59Z') }, // quarter
      { from: d('2026-01-01T00:00:00Z'), to: d('2026-12-31T23:59:59Z') }, // year
    ]
    const u = unionWindows(windows)
    for (const w of windows) expect(windowContains(u, w)).toBe(true)
  })

  it('covers a trailing week that reaches back into last year', () => {
    // Jan 3rd: the Valley's 7 days start before the year window does.
    const week = { from: d('2025-12-28T00:00:00Z'), to: d('2026-01-03T23:59:59Z') }
    const year = { from: d('2026-01-01T00:00:00Z'), to: d('2026-12-31T23:59:59Z') }
    const u = unionWindows([week, year])
    expect(windowContains(u, week)).toBe(true)
    expect(windowContains(u, year)).toBe(true)
    expect(windowContains(year, week)).toBe(false) // the year alone would miss it
  })

  it('stays unbounded on a side where any input is unbounded', () => {
    expect(unionWindows([{}, { from: d('2026-01-01T00:00:00Z') }])).toEqual({})
    const u = unionWindows([
      { to: d('2026-06-30T00:00:00Z') },
      { from: d('2026-01-01T00:00:00Z'), to: d('2026-03-31T00:00:00Z') },
    ])
    expect(u.from).toBeUndefined()
    expect(u.to?.toISOString()).toBe('2026-06-30T00:00:00.000Z')
  })
})

describe('readWindowCache / writeWindowCache', () => {
  beforeEach(() => clearAllCache())

  const year: CacheWindow = { from: d('2026-01-01T00:00:00Z'), to: d('2026-12-31T23:59:59Z') }
  const march: CacheWindow = { from: d('2026-03-01T00:00:00Z'), to: d('2026-03-31T23:59:59Z') }

  const rows: Row[] = [
    { at: '2026-01-15T12:00:00Z' },
    { at: '2026-03-02T12:00:00Z' },
    { at: '2026-03-30T12:00:00Z' },
    { at: '2026-11-01T12:00:00Z' },
  ]

  it('misses when nothing is cached', () => {
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toBeNull()
  })

  it('returns an exact-window hit untouched', () => {
    writeWindowCache(PREFIX, march, rows)
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toEqual(rows)
  })

  it('answers a narrower window by filtering a cached wider one', () => {
    writeWindowCache(PREFIX, year, rows)
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toEqual([
      { at: '2026-03-02T12:00:00Z' },
      { at: '2026-03-30T12:00:00Z' },
    ])
  })

  it('an all-time read answers every window', () => {
    writeWindowCache(PREFIX, {}, rows)
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toHaveLength(2)
    expect(readWindowCache<Row>(PREFIX, year, dateOf)).toHaveLength(4)
  })

  it('will not answer a wider window from a narrower cached one', () => {
    writeWindowCache(PREFIX, march, rows.slice(1, 3))
    expect(readWindowCache<Row>(PREFIX, year, dateOf)).toBeNull()
    expect(readWindowCache<Row>(PREFIX, undefined, dateOf)).toBeNull()
  })

  it('prefers the tightest cached superset', () => {
    // The wide entry is deliberately wrong; picking it would prove we took the
    // loosest match rather than the closest.
    writeWindowCache(PREFIX, { from: d('2020-01-01T00:00:00Z'), to: d('2030-01-01T00:00:00Z') }, [
      { at: '2026-03-10T12:00:00Z' },
      { at: '2026-03-11T12:00:00Z' },
    ])
    writeWindowCache(PREFIX, year, rows)
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toEqual([
      { at: '2026-03-02T12:00:00Z' },
      { at: '2026-03-30T12:00:00Z' },
    ])
  })

  it('drops cached windows a newly written one subsumes', () => {
    writeWindowCache(PREFIX, march, rows.slice(1, 3))
    writeWindowCache(PREFIX, year, rows)
    // March is gone as its own entry, but still answerable from the year.
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toHaveLength(2)
    writeWindowCache(PREFIX, year, [])
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toEqual([])
  })

  it('ignores keys belonging to another namespace', () => {
    setCache(`other:rows:${windowCacheKey({})}`, rows)
    expect(readWindowCache<Row>(PREFIX, march, dateOf)).toBeNull()
  })
})

describe('owner scrub', () => {
  beforeEach(() => clearAllCache())

  it('bumps the generation and rejects a read that started before it', () => {
    const gen = cacheGeneration()
    expect(() => assertSameOwner(gen)).not.toThrow()
    clearAllCache()
    expect(() => assertSameOwner(gen)).toThrow(CacheOwnerChangedError)
  })

  it('notifies subscribers so they can drop in-flight reads', () => {
    let cleared = 0
    onCacheCleared(() => {
      cleared += 1
    })
    clearAllCache()
    clearAllCache()
    expect(cleared).toBe(2)
  })

  it('drops every window entry, so nothing survives into the next session', () => {
    writeWindowCache(PREFIX, {}, [{ at: '2026-03-02T12:00:00Z' }])
    expect(readWindowCache<Row>(PREFIX, undefined, dateOf)).toHaveLength(1)
    clearAllCache()
    expect(readWindowCache<Row>(PREFIX, undefined, dateOf)).toBeNull()
  })
})
