import { beforeEach, describe, expect, it } from 'vitest'
import type { Rollup } from '@/lib/insights'
import { positionInYear, yearProgress, yearStones } from './data/stones'
import { yearLongLook, yearWords } from './data/words'
import { recordClimb, sinceLastClimb } from './lastClimb'
import { namingMarker } from './summitNaming'
import { mergeYears, windowForYear } from './data/summitYear'
import { PEAK, pointOnTrail } from './trailPath'
import type { SummitStone } from './data/types'

const YEAR = 2026

function rollup(reflection: Rollup['payload']['reflection']): Rollup {
  return {
    id: 'r1',
    type: 'yearly',
    period_start: `${YEAR}-01-01`,
    period_end: `${YEAR}-12-31`,
    source_ids: [],
    payload: {
      period: { type: 'yearly', start: `${YEAR}-01-01`, end: `${YEAR}-12-31` },
      quotes: [],
      facts: { days_written: 0, days_in_period: 0, words: 0, longest_streak: 0, weeks_reflected: null },
      observation: null,
      topics: [],
      ...(reflection ? { reflection } : {}),
      meta: { model: 'test', generated_at: '' },
    },
  }
}

function pair(id: string, askDate: string, laterDate: string) {
  return {
    id,
    ask: { entry_id: `ask-${id}`, date: askDate, text: 'Please let it come back clean.' },
    later: { entry_id: `later-${id}`, date: laterDate, text: 'Clean. I sat in the car for twenty minutes.' },
  }
}

describe('yearStones', () => {
  it('reads the pairings the yearly rollup has always produced', () => {
    const stones = yearStones(rollup({ stones: [pair('a', `${YEAR}-03-02`, `${YEAR}-04-14`)] }), YEAR)
    expect(stones).toHaveLength(1)
    expect(stones[0]!.ask.entryId).toBe('ask-a')
    expect(stones[0]!.later.entryId).toBe('later-a')
  })

  it('places a stone by the date the ANSWER arrived, not the asking', () => {
    const [stone] = yearStones(rollup({ stones: [pair('a', `${YEAR}-01-02`, `${YEAR}-07-02`)] }), YEAR)
    // Early July is a touch past halfway through the year.
    expect(stone!.position).toBeGreaterThan(0.49)
    expect(stone!.position).toBeLessThan(0.55)
  })

  it('orders the trail bottom to top, the way it was climbed', () => {
    const stones = yearStones(
      rollup({
        stones: [
          pair('late', `${YEAR}-08-01`, `${YEAR}-11-12`),
          pair('early', `${YEAR}-02-09`, `${YEAR}-04-01`),
        ],
      }),
      YEAR,
    )
    expect(stones.map((s) => s.id)).toEqual(['early', 'late'])
  })

  it('drops a pairing whose answer does not come after its ask', () => {
    const backwards = yearStones(rollup({ stones: [pair('a', `${YEAR}-06-01`, `${YEAR}-03-01`)] }), YEAR)
    expect(backwards).toEqual([])
    const sameDay = yearStones(rollup({ stones: [pair('a', `${YEAR}-06-01`, `${YEAR}-06-01`)] }), YEAR)
    expect(sameDay).toEqual([])
  })

  it('never sets the same moment on the mountain twice', () => {
    // A rebuild of the open year can surface one pairing under a fresh id.
    const first = pair('a', `${YEAR}-03-02`, `${YEAR}-04-14`)
    const again = { ...first, id: 'b' }
    expect(yearStones(rollup({ stones: [first, again] }), YEAR)).toHaveLength(1)
  })

  it('is empty, not broken, when the year has no stones', () => {
    expect(yearStones(rollup({}), YEAR)).toEqual([])
    expect(yearStones(null, YEAR)).toEqual([])
    expect(yearStones(undefined, YEAR)).toEqual([])
  })
})

describe('positionInYear / yearProgress', () => {
  it('clamps a date from outside the year onto the trail', () => {
    expect(positionInYear(`${YEAR - 1}-06-01`, YEAR)).toBe(0)
    expect(positionInYear(`${YEAR + 1}-06-01`, YEAR)).toBe(1)
  })

  it('tracks the CALENDAR, so the peak is reached on the last day of the year', () => {
    expect(yearProgress(new Date(`${YEAR}-01-01T00:00:00Z`))).toBeCloseTo(0, 2)
    expect(yearProgress(new Date(`${YEAR}-12-31T23:59:00Z`))).toBeGreaterThan(0.999)
  })
})

describe('yearWords', () => {
  it('shows the refrain, verbatim', () => {
    const words = yearWords(
      rollup({
        refrain: {
          entry_id: 'e1',
          date: `${YEAR}-07-09`,
          text: 'I am not being taken out of it.',
          char_start: 0,
          char_end: 31,
        },
      }),
      YEAR,
    )
    expect(words!.moments[0]!.text).toBe('I am not being taken out of it.')
    expect(words!.periodLabel).toBe(String(YEAR))
  })

  it('carries no arcs — the yearly pass has never written one', () => {
    const words = yearWords(
      rollup({
        refrain: { entry_id: 'e1', date: `${YEAR}-07-09`, text: 'x', char_start: 0, char_end: 1 },
        arcs: [{ id: 'a', name: 'Waiting', note: 'note', weight: 3, entry_ids: [] }],
      }),
      YEAR,
    )
    expect(words!.arcs).toEqual([])
  })

  it('is null when no single line carried the year', () => {
    expect(yearWords(rollup({ throughline: ['a'] }), YEAR)).toBeNull()
  })
})

describe('yearLongLook', () => {
  it('surfaces the throughline the app used to generate and discard', () => {
    const look = yearLongLook(rollup({ throughline: ['Who you were.', 'Who you are.'], themes: ['Waiting.'] }))
    expect(look!.throughline).toHaveLength(2)
    expect(look!.themes).toEqual(['Waiting.'])
  })

  it('is null rather than an empty panel when the year wrote neither', () => {
    expect(yearLongLook(rollup({ throughline: [], themes: ['  '] }))).toBeNull()
    expect(yearLongLook(null)).toBeNull()
  })
})

describe('pointOnTrail', () => {
  it('starts on the ground and ends at the peak', () => {
    expect(pointOnTrail(0)).toEqual({ x: 120, y: 280 })
    const top = pointOnTrail(1)
    expect(top.x).toBeCloseTo(PEAK[0], 0)
    expect(top.y).toBeLessThan(60)
  })

  it('climbs monotonically, so a later stone is never below an earlier one', () => {
    let previous = pointOnTrail(0).y
    for (let f = 0.05; f <= 1; f += 0.05) {
      const y = pointOnTrail(f).y
      expect(y).toBeLessThanOrEqual(previous + 0.001)
      previous = y
    }
  })

  it('clamps rather than running off the mountain', () => {
    expect(pointOnTrail(-3)).toEqual(pointOnTrail(0))
    expect(pointOnTrail(9)).toEqual(pointOnTrail(1))
  })

  it('spaces evenly by ARC length, so two stones a month apart sit a month apart', () => {
    // Measured along the curve rather than across the chord: the trail bends, so
    // a straight line between two points on it is shorter than the walk.
    const arc = (from: number, to: number) => {
      let total = 0
      let previous = pointOnTrail(from)
      for (let i = 1; i <= 200; i++) {
        const next = pointOnTrail(from + ((to - from) * i) / 200)
        total += Math.hypot(next.x - previous.x, next.y - previous.y)
        previous = next
      }
      return total
    }
    const first = arc(0.25, 0.5)
    const second = arc(0.5, 0.75)
    expect(Math.abs(first - second) / first).toBeLessThan(0.01)
  })
})

describe('sinceLastClimb / recordClimb', () => {
  const stone = (id: string, laterDate: string): SummitStone => ({
    id,
    ask: { entryId: `a${id}`, date: `${YEAR}-01-01`, dateLabel: 'Jan 1', text: 'ask' },
    later: { entryId: `l${id}`, date: laterDate, dateLabel: 'later', text: 'later' },
    position: 0.5,
  })

  /** What the component does across one visit: read the diff, then record. */
  const climb = (year: number, stones: SummitStone[], hasRefrain: boolean) => {
    const since = sinceLastClimb(year, stones, hasRefrain)
    recordClimb(year, stones, hasRefrain)
    return since
  }

  // Minimal localStorage stand-in — these tests run in the `node` environment.
  beforeEach(() => {
    const store = new Map<string, string>()
    ;(globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage
  })

  it('says nothing on the first ever climb — everything is new then', () => {
    const since = climb(YEAR, [stone('a', `${YEAR}-04-01`)], true)
    expect(since.newStones).toEqual([])
    expect(since.refrainArrived).toBe(false)
  })

  it('reports only what arrived since the last visit', () => {
    climb(YEAR, [stone('a', `${YEAR}-04-01`)], false)
    const since = climb(YEAR, [stone('a', `${YEAR}-04-01`), stone('b', `${YEAR}-09-03`)], true)
    expect(since.newStones.map((s) => s.id)).toEqual(['b'])
    expect(since.refrainArrived).toBe(true)
  })

  it('is silent when nothing arrived, which is most visits', () => {
    const stones = [stone('a', `${YEAR}-04-01`)]
    climb(YEAR, stones, true)
    const since = climb(YEAR, stones, true)
    expect(since.newStones).toEqual([])
    expect(since.refrainArrived).toBe(false)
  })

  it('starts the new year silent rather than announcing an empty one', () => {
    climb(YEAR, [stone('a', `${YEAR}-12-30`)], true)
    const since = climb(YEAR + 1, [], false)
    expect(since.newStones).toEqual([])
    expect(since.refrainArrived).toBe(false)
  })

  it('survives a double render, because reading never records', () => {
    // React renders twice in development. When the read and the write were one
    // call, the second pass compared against what the first had just written and
    // the line went silent in dev while working in production.
    climb(YEAR, [stone('a', `${YEAR}-04-01`)], false)
    const withB = [stone('a', `${YEAR}-04-01`), stone('b', `${YEAR}-09-03`)]
    const first = sinceLastClimb(YEAR, withB, false)
    const second = sinceLastClimb(YEAR, withB, false)
    expect(first.newStones.map((x) => x.id)).toEqual(['b'])
    expect(second.newStones.map((x) => x.id)).toEqual(['b'])
  })

  it('never counts entries or names a gap — it only ever reports content', () => {
    // A guard on the shape of the result: adding anything behaviour-shaped here
    // (days since, entries written, a streak) is the failure this file watches.
    const since = climb(YEAR, [], false)
    expect(Object.keys(since).sort()).toEqual(['newStones', 'refrainArrived'])
  })
})

describe('namingMarker', () => {
  it('is an HTML comment, so it never shows in the page the writer keeps', () => {
    expect(namingMarker(YEAR)).toBe(`<!-- summit:year:${YEAR} -->`)
  })
})

describe('the year rail', () => {
  it('always holds the year you are standing in, even before it has anything', () => {
    // 1 January: no yearly rollup for the new year yet, and it is still the one
    // you are in — the rail would be lying if it started at last year.
    expect(mergeYears(['2025-01-01', '2024-01-01'], 2026)).toEqual([2026, 2025, 2024])
  })

  it('reads newest first — "last year" is a shorter reach than 2011', () => {
    expect(mergeYears(['2011-01-01', '2019-01-01', '2015-01-01'], 2019)).toEqual([
      2019, 2015, 2011,
    ])
  })

  it('never lists a year twice when the current one is already built', () => {
    expect(mergeYears(['2026-01-01', '2025-01-01'], 2026)).toEqual([2026, 2025])
  })

  it('drops a period it cannot read rather than rendering NaN', () => {
    expect(mergeYears(['', 'not-a-date', '2025-01-01'], 2026)).toEqual([2026, 2025])
  })
})

describe('windowForYear', () => {
  it('covers the whole calendar year, whatever the reader timezone', () => {
    const w = windowForYear(2019)
    expect(w.from.toISOString()).toBe('2019-01-01T00:00:00.000Z')
    expect(w.to.toISOString()).toBe('2019-12-31T23:59:59.999Z')
  })
})
