import { describe, expect, it } from 'vitest'
import { anniversaryLabel, findAnniversaries } from './anniversaries'
import type { Entry } from '@/lib/types'

let n = 0
/** Local noon, so the test never straddles a timezone's midnight. */
function entry(dateLocal: string, id = `e${++n}`): Entry {
  const [y, m, d] = dateLocal.split('-').map(Number)
  return {
    id,
    created_at: new Date(y!, m! - 1, d!, 12).toISOString(),
    updated_at: new Date(y!, m! - 1, d!, 12).toISOString(),
    body_markdown: `written on ${dateLocal}`,
    title: null,
    mood: null,
    tags: [],
    word_count: 3,
    source: 'native',
    external_id: null,
  }
}

/** Enough pages in a month to clear the thin-stretch guard. */
function month(year: number, mon: number, days: number[]): Entry[] {
  return days.map((d) => entry(`${year}-${String(mon).padStart(2, '0')}-${String(d).padStart(2, '0')}`))
}

describe('findAnniversaries', () => {
  it('is empty with nothing to read', () => {
    expect(findAnniversaries([])).toEqual([])
  })

  it('finds the same week in an earlier year', () => {
    const older = month(2016, 6, [10, 11])
    const recent = month(2021, 6, [10, 12])
    const all = [...recent, ...older]

    const found = findAnniversaries(all)
    expect(found).toHaveLength(1)
    expect(found[0]!.yearsAgo).toBe(5)
    expect(found[0]!.sameDay).toBe(true)
    expect(found[0]!.anchorId).toBe(recent[0]!.id)
  })

  it('never looks forward in time', () => {
    const all = [...month(2016, 6, [10, 11]), ...month(2021, 6, [10, 11])]
    // Anchoring only on the OLD pages leaves nothing earlier to find.
    expect(findAnniversaries(month(2016, 6, [10, 11]), all)).toEqual([])
  })

  it('reaches for the most distant year, not the nearest', () => {
    const all = [
      ...month(2021, 3, [4, 5]),
      ...month(2019, 3, [4, 5]),
      ...month(2013, 3, [4, 5]),
    ]
    const found = findAnniversaries(all)
    expect(found[0]!.yearsAgo).toBe(8)
  })

  it('matches within the same week, not only the same day', () => {
    const all = [...month(2022, 9, [14, 15]), ...month(2015, 9, [16, 17])]
    const found = findAnniversaries(all)
    expect(found).toHaveLength(1)
    expect(found[0]!.sameDay).toBe(false)
  })

  it('ignores dates outside the window', () => {
    const all = [...month(2022, 9, [1, 2]), ...month(2015, 9, [25, 26])]
    expect(findAnniversaries(all)).toEqual([])
  })

  it('treats late December and early January as the same week', () => {
    const all = [...month(2022, 1, [1, 2]), ...month(2016, 12, [30, 31])]
    const found = findAnniversaries(all)
    expect(found).toHaveLength(1)
  })

  it('skips a thin stretch rather than commenting on the emptiness', () => {
    const lone = entry('2021-06-10')
    const all = [lone, ...month(2016, 6, [10, 11])]
    expect(findAnniversaries(all)).toEqual([])
  })

  it('takes a caller-supplied gap, so the wall can space them in rows', () => {
    const recent = month(2021, 6, [1, 2, 3, 4, 5, 6, 7])
    const older = month(2015, 6, [1, 2, 3, 4, 5, 6, 7])
    // A gap of 2 lets several through where the default of 12 allows only one.
    const found = findAnniversaries([...recent, ...older], [...recent, ...older], 2)
    expect(found.length).toBeGreaterThan(1)
  })

  it('spaces echoes out and never reuses a page', () => {
    const recent = month(2021, 6, [1, 2, 3, 4, 5, 6, 7])
    const older = month(2015, 6, [1, 2, 3, 4, 5, 6, 7])
    const found = findAnniversaries([...recent, ...older])

    // Seven candidate anchors in a row, but they sit inside one screenful.
    expect(found).toHaveLength(1)
    const ids = found.map((a) => a.entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('anniversaryLabel', () => {
  const base = { anchorId: 'a', entry: entry('2015-06-10'), sameDay: true }

  it('states the fact and nothing more', () => {
    expect(anniversaryLabel({ ...base, yearsAgo: 4 })).toBe('Four years earlier · the same day')
  })

  it('says week when it is only the same week', () => {
    expect(anniversaryLabel({ ...base, yearsAgo: 1, sameDay: false })).toBe(
      'One year earlier · the same week',
    )
  })

  it('falls back to a numeral past the spelled-out range', () => {
    expect(anniversaryLabel({ ...base, yearsAgo: 14 })).toBe('14 years earlier · the same day')
  })
})
