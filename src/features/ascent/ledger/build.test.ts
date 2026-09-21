import { describe, expect, it } from 'vitest'
import type { Subject } from '@/features/pages/subjects'
import { buildYearLedger, clip, isMarkedEntry, type LedgerInput } from './build'
import { presence, score, DEFAULT_WEIGHTS } from './score'

let n = 0
function entry(date: string, body: string, words = 60) {
  n++
  return { id: `e${n}`, created_at: `${date}T12:00:00Z`, body_markdown: body, word_count: words }
}
function name(label: string, terms: string[] = [label]): Subject {
  return { key: `c:${label.toLowerCase()}`, label, terms, kind: 'person' }
}

function fixture(): LedgerInput & { ids: Record<string, string> } {
  n = 0
  const e = {
    // earlier years: Maya and God every year → both should be damped
    old1: entry('2023-05-01', 'Maya lost a tooth. God is good.'),
    old2: entry('2024-05-01', 'Maya started school. God is good.'),
    // the year: Dad's diagnosis, prayed Mar–Oct with a quiet stretch, then learned
    d1: entry('2025-03-06', 'Dad called about the scan.'),
    d2: entry('2025-03-12', 'Pray for Dad.'),
    d3: entry('2025-04-09', "Dad's biopsy is Thursday."),
    d4: entry('2025-08-20', 'Dad again today.'),
    d5: entry('2025-10-09', "Dad's scan is clear."),
    // Maya, present but constant
    m1: entry('2025-01-10', 'Maya drew a picture. God is good.'),
    m2: entry('2025-06-10', 'Maya laughed at dinner. God is good.'),
    // one beautiful week
    l1: entry('2025-07-08', 'Lisbon light, gold on every wall.'),
    l2: entry('2025-07-11', 'Lisbon cathedral, crying.'),
    // a verse, twice, months apart
    v1: entry('2025-02-04', 'Psalm 131:2 — I have calmed and quieted my soul.'),
    v2: entry('2025-11-02', 'Psalm 131 again this morning.'),
  }
  const ids = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, v.id]))
  return {
    ids,
    entries: Object.values(e),
    matters: [
      {
        id: 'dad',
        label: "Dad's health",
        members: [
          { itemId: 'i1', entryId: ids.d2!, content: 'Pray for Dad.', type: 'prayer' },
          { itemId: 'i2', entryId: ids.d3!, content: "Dad's biopsy is Thursday.", type: 'prayer' },
          { itemId: 'i3', entryId: ids.d4!, content: 'Dad again today.', type: 'learned' },
          { itemId: 'i4', entryId: ids.d5!, content: "Dad's scan is clear.", type: 'sense' },
        ],
      },
    ],
    names: [name('Dad'), name('Maya'), name('God'), name('Lisbon')],
    refs: [
      { entryId: ids.v1!, bookOsis: 'Ps', chapter: 131, osisRef: 'Ps.131.2', charStart: 0, charEnd: 11 },
      { entryId: ids.v2!, bookOsis: 'Ps', chapter: 131, osisRef: 'Ps.131', charStart: 0, charEnd: 9 },
    ],
    markings: [],
    encounters: [{ threadId: 'dad', movement: 'answered', namedAt: '2025-10-09T20:00:00Z', sourceEntryId: ids.d5!, reflection: null }],
  }
}

describe('presence', () => {
  it('counts months, mentions, and returns after two quiet months', () => {
    expect(presence([1, 0, 0, 2, 0, 1])).toEqual({ months: 3, mentions: 4, returns: 1 })
    expect(presence([1, 0, 0, 2], 2)).toEqual({ months: 1, mentions: 1, returns: 0 })
  })
  it('damps a subject present in every earlier year', () => {
    const f = { months: 12, mentions: 100, returns: 0, movement: 0, marked: 0 }
    expect(score(f, 1)).toBeCloseTo(score(f, 0) * (1 - DEFAULT_WEIGHTS.damp))
  })
})

describe('buildYearLedger', () => {
  const input = fixture()
  const ledger = buildYearLedger(input, 2025)
  const byLabel = Object.fromEntries(ledger.threads.map((t) => [t.label, t]))

  it('folds a name into the Altar matter it already is, and leads with it', () => {
    // "Dad" the name and "Dad's health" the matter are the same subject
    expect(byLabel['Dad']).toBeUndefined()
    expect(ledger.threads[0]!.label).toBe("Dad's health")
    expect(ledger.threads[0]!.perMonth.slice(2, 10)).toEqual([2, 1, 0, 0, 0, 1, 0, 1])
  })

  it('never makes the addressee a subject', () => {
    expect(byLabel['God']).toBeUndefined()
  })

  it('ranks the plain ten-month prayer above the constant name and the one lovely week', () => {
    const order = ledger.threads.map((t) => t.label)
    expect(order.indexOf("Dad's health")).toBeLessThan(order.indexOf('Maya'))
    expect(order.indexOf("Dad's health")).toBeLessThan(order.indexOf('Lisbon'))
  })

  it('reads a verse chapter as a thread, and sees that it came back', () => {
    const v = byLabel['Psalm 131']!
    expect(v.kind).toBe('verse')
    expect(v.returned).toBe(true)
  })

  it('sets a stone from an answered prayer, pairing the ask that opened it', () => {
    expect(ledger.stones).toHaveLength(1)
    expect(ledger.stones[0]!.ask.text).toBe('Pray for Dad.')
    expect(ledger.stones[0]!.later.text).toBe("Dad's scan is clear.")
  })

  it('sees a prayer turn into something learned', () => {
    const dad = ledger.threads[0]!
    expect(dad.events.map((e) => e.type)).toEqual(['turn', 'answered'])
    expect(dad.lines.find((l) => l.flag === 'turn')!.text).toBe('Dad again today.')
  })

  it('keeps every line verbatim', () => {
    const all = input.entries.map((e) => e.body_markdown).join('\n')
    for (const t of ledger.threads) for (const l of t.lines) expect(all).toContain(l.text)
  })

  it('an open year only counts the months behind it', () => {
    const early = buildYearLedger(fixture(), 2025, 4)
    const dad = early.threads.find((t) => t.label === "Dad's health")!
    expect(dad.perMonth.slice(4).every((c) => c === 0)).toBe(true)
    expect(early.stones).toHaveLength(0)
  })
})

describe('helpers', () => {
  it('clips a long line to the sentence that holds the match', () => {
    const long = `${'Filler words here. '.repeat(20)}Dad is home. ${'More filler. '.repeat(10)}`
    expect(clip(long, /dad/gi)).toBe('Dad is home.')
  })
  it('knows an entry the writer set apart', () => {
    expect(isMarkedEntry('## Grandma', 50, 100)).toBe(true)
    expect(isMarkedEntry('a ==kept line== here', 50, 100)).toBe(true)
    expect(isMarkedEntry('plain', 50, 100)).toBe(false)
    expect(isMarkedEntry('plain', 400, 100)).toBe(true)
  })
})
