import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import {
  bursts,
  defaultSplit,
  inOrder,
  thenAndNow,
  quietFor,
  wordFloor,
  wordsUsed,
  yearsIn,
} from './readings'

let n = 0
/**
 * A page dated in LOCAL time, which is what the readings split on.
 *
 * `new Date('2025-01-01')` is UTC midnight, and west of Greenwich that is the
 * 31st of December 2024 — so a fixture built that way lands its January pages
 * in the previous year and every span test is off by one. Entries are written
 * and read in the writer's own day, not in UTC.
 */
function entry(local: string, body = 'a quiet day'): Entry {
  const [y, m, d] = local.split('-').map(Number)
  const at = new Date(y!, (m ?? 1) - 1, d ?? 1, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: at,
    updated_at: at,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  }
}

describe('inOrder', () => {
  it('is oldest first', () => {
    const a = entry('2024-03-01')
    const b = entry('2022-01-01')
    const c = entry('2023-06-01')
    expect(inOrder([a, b, c]).map((e) => e.id)).toEqual([b.id, c.id, a.id])
  })

  // A subset would be a judgement about which pages were the good ones.
  it('returns every page it was given', () => {
    const list = [entry('2024-01-01'), entry('2024-01-02'), entry('2024-01-03')]
    expect(inOrder(list)).toHaveLength(3)
  })
})

describe('thenAndNow', () => {
  const list = [
    entry('2022-05-01'),
    entry('2023-02-01'),
    entry('2025-04-01'),
    entry('2026-01-01'),
  ]

  it('splits on the year, inclusive of the split on the later side', () => {
    const { before, after } = thenAndNow(list, 2025)
    expect(before).toHaveLength(2)
    expect(after).toHaveLength(2)
  })

  // An uneven comparison reads as a verdict on the thinner side, and the reader
  // can only discount it if they can see it.
  it('never loses a page between the two spans', () => {
    for (const split of [2022, 2023, 2024, 2025, 2026, 2027]) {
      const { before, after } = thenAndNow(list, split)
      expect(before.length + after.length).toBe(list.length)
    }
  })

  it('opens on a split with pages on both sides', () => {
    const split = defaultSplit(list)
    const { before, after } = thenAndNow(list, split)
    expect(before.length).toBeGreaterThan(0)
    expect(after.length).toBeGreaterThan(0)
  })

  it('survives an archive with one year in it', () => {
    expect(() => defaultSplit([entry('2024-01-01')])).not.toThrow()
    expect(yearsIn([entry('2024-01-01'), entry('2024-08-01')])).toEqual([2024])
  })
})

describe('bursts', () => {
  /*
   * An episode is a run of entries with quiet on both sides. Arithmetic and
   * nothing else — the app never says these are stories.
   */
  it('breaks a stretch where the silence is', () => {
    const list = [
      entry('2024-01-01'),
      entry('2024-01-03'),
      entry('2024-01-06'),
      // ten months of nothing
      entry('2024-11-01'),
      entry('2024-11-04'),
      entry('2024-11-09'),
    ]
    const found = bursts(list, { quiet: 50, min: 3 })
    expect(found).toHaveLength(2)
    expect(found[0]!.entries).toHaveLength(3)
    expect(found[1]!.entries).toHaveLength(3)
  })

  it('counts the days a stretch spans, inclusive', () => {
    const found = bursts(
      [entry('2024-01-01'), entry('2024-01-15'), entry('2024-01-30')],
      { quiet: 50, min: 3 },
    )
    expect(found[0]!.days).toBe(30)
  })

  it('measures the silence before a stretch', () => {
    const list = [
      entry('2024-01-01'),
      entry('2024-01-02'),
      entry('2024-01-03'),
      entry('2024-06-01'),
      entry('2024-06-02'),
      entry('2024-06-03'),
    ]
    const found = bursts(list, { quiet: 50, min: 3 })
    expect(found[0]!.quietDaysBefore).toBe(0)
    expect(found[1]!.quietDaysBefore).toBeGreaterThan(100)
  })

  it('does not call two pages a stretch', () => {
    expect(bursts([entry('2024-01-01'), entry('2024-01-02')], { min: 3 })).toEqual([])
  })

  it('is empty rather than throwing on an empty archive', () => {
    expect(bursts([])).toEqual([])
  })

  // No stretch may hold a page twice, and none may be lost between them.
  it('accounts for every page exactly once across the stretches it keeps', () => {
    const list = Array.from({ length: 12 }, (_, i) => entry(`2024-01-${String(1 + i).padStart(2, '0')}`))
    const found = bursts(list, { quiet: 50, min: 3 })
    const ids = found.flatMap((b) => b.entries.map((e) => e.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the words you used', () => {
  const before = [
    entry('2022-01-01', 'the appointment was sharp and I was scared'),
    entry('2022-02-01', 'another appointment, and scared again about the routine'),
  ]
  const after = [
    entry('2025-01-01', 'we laughed in the garden and she held my hand'),
    entry('2025-02-01', 'the garden again, she laughed, we held the afternoon'),
  ]

  it('says what started and what stopped, and neither is a score', () => {
    const out = wordsUsed([...before, ...after], 2025)
    expect(out.started).toContain('garden')
    expect(out.started).toContain('laughed')
    expect(out.stopped).toContain('appointment')
    expect(out.stopped).toContain('scared')
  })

  /*
   * THE FLOOR IS THE ONLY LEGAL WAY TO SHORTEN THIS. "Appears in at least two
   * pages" is arithmetic about the text, where "the most significant thirty"
   * would be selection — and selection is significance, and significance is a
   * verdict (D-016).
   */
  it('drops a word said only once in its span', () => {
    const out = wordsUsed(
      [
        entry('2022-01-01', 'a solitary mention of tomatoes'),
        entry('2022-02-01', 'nothing of the sort here'),
        entry('2025-01-01', 'plain'),
        entry('2025-02-01', 'plain'),
      ],
      2025,
    )
    expect(out.stopped).not.toContain('tomatoes')
    expect(out.floor).toBe(2)
  })

  // Ordered by first appearance, never by frequency — there is no count to
  // sort by, and that is the point.
  it('orders by first appearance rather than by how often', () => {
    const out = wordsUsed(
      [
        entry('2020-01-01', 'plain'),
        entry('2020-02-01', 'plain'),
        entry('2025-01-01', 'rarely mentioned bicycle'),
        entry('2025-02-01', 'bicycle again, plus kettle kettle'),
        entry('2025-03-01', 'kettle once more, kettle'),
      ],
      2025,
    )
    expect(out.started.indexOf('bicycle')).toBeLessThan(out.started.indexOf('kettle'))
  })

  it('keeps the page count for each span on hand', () => {
    const out = wordsUsed([...before, ...after], 2025)
    expect(out.beforePages).toBe(2)
    expect(out.afterPages).toBe(2)
  })

  // The subject's own name is not a finding about the subject.
  it('never reports the subject back to itself', () => {
    const out = wordsUsed(
      [
        entry('2022-01-01', 'naomi and naomi and the harbour'),
        entry('2022-02-01', 'naomi at the harbour'),
        entry('2025-01-01', 'plain'),
        entry('2025-02-01', 'plain'),
      ],
      2025,
      ['Naomi'],
    )
    expect(out.stopped).not.toContain('naomi')
    expect(out.stopped).toContain('harbour')
  })

  it('says nothing rather than inventing a shift on a thin archive', () => {
    const out = wordsUsed([entry('2024-01-01', 'one page only')], 2024)
    expect(out.started).toEqual([])
    expect(out.stopped).toEqual([])
  })
})

describe('the floor scales to the archive', () => {
  /*
   * Two pages is right on a 47-entry fixture and badly wrong on a real one:
   * across 3,580 pages it leaves thousands of words and returns exactly the
   * word cloud the floor exists to prevent.
   */
  it('stays at two on a small archive', () => {
    expect(wordFloor(20, 27)).toBe(2)
  })

  it('rises with the span, so a real archive is not a word cloud', () => {
    expect(wordFloor(1545, 2035)).toBe(16)
  })

  // Giving each span its own bar would make a word "stopped" purely because the
  // spans are different sizes — an artifact of the split, not of the writer.
  it('holds both spans to the same bar, taken from the smaller', () => {
    expect(wordFloor(300, 5000)).toBe(wordFloor(5000, 300))
    expect(wordFloor(300, 5000)).toBe(3)
  })
})

describe('silence is relative to how often you write', () => {
  const daily = Array.from({ length: 40 }, (_, i) =>
    entry(`2024-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`),
  )

  /*
   * A fixed threshold cannot work. Fifty days is a long silence for someone who
   * writes twice a year and no silence at all for someone who writes every
   * morning — on the real archive a fixed 50 returned one "stretch" of 1,414
   * pages, which is not a stretch, it is the journal.
   */
  it('treats a fortnight as silence for someone who writes daily', () => {
    expect(quietFor(daily)).toBe(14)
  })

  it('treats months as silence for someone who writes twice a year', () => {
    const sparse = ['2020-01-01', '2020-07-01', '2021-01-01', '2021-07-01'].map((d) => entry(d))
    expect(quietFor(sparse)).toBeGreaterThan(300)
  })

  it('never lets one ancient page make everything look quiet', () => {
    const withOutlier = [entry('2005-01-01'), ...daily]
    // A mean would be dragged past a decade; the median is unmoved.
    expect(quietFor(withOutlier)).toBe(14)
  })

  // Someone who writes forty days straight has ONE stretch, and saying so is
  // the honest answer rather than a failure to split.
  it('leaves an unbroken run as one stretch', () => {
    expect(bursts(daily)).toHaveLength(1)
  })

  it('splits on a gap that is a silence for this writer, without being told', () => {
    const withGap = [
      ...['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04'].map((d) => entry(d)),
      // Six weeks — nothing to a twice-a-year writer, a long quiet to a daily one.
      ...['2024-02-20', '2024-02-21', '2024-02-22', '2024-02-23'].map((d) => entry(d)),
    ]
    expect(bursts(withGap)).toHaveLength(2)
  })
})
