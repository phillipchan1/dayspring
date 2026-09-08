import { describe, expect, it } from 'vitest'
import { eraLabel, erasFrom } from './eras'
import { monthsAcross } from './band'
import { quietFor } from './readings'
import type { Entry } from '@/lib/types'

const page = (iso: string): Entry =>
  ({
    id: iso,
    created_at: new Date(iso).toISOString(),
    updated_at: iso,
    body_markdown: 'a page',
    title: null,
    mood: null,
    tags: [],
    word_count: 2,
    source: 'native',
    external_id: null,
  }) as Entry

/**
 * `n` pages, one a day, from a LOCAL date at noon.
 *
 * Noon, and local, on purpose: `monthsAcross` and `monthIndex` read a date with
 * `getFullYear`/`getMonth`, so a fixture pinned to UTC midnight lands in the
 * previous month west of Greenwich and the whole suite passes or fails by
 * timezone.
 */
function run(startIso: string, n: number): Entry[] {
  const start = new Date(`${startIso}T12:00:00`).getTime()
  return Array.from({ length: n }, (_, i) => page(new Date(start + i * 86_400_000).toISOString()))
}

const eras = (entries: Entry[]) => erasFrom(entries, monthsAcross(entries))

describe('erasFrom', () => {
  it('offers a period per stretch of writing, in the order they happened', () => {
    const entries = [...run('2019-01-01', 20), ...run('2021-06-01', 30), ...run('2024-03-01', 25)]
    const out = eras(entries)
    expect(out.map((e) => e.pages)).toEqual([20, 30, 25])
  })

  /*
   * IT DOES NOT DEFINE ITS OWN SILENCE. `quietFor` is the writer's own rhythm —
   * six times their median gap — and the `close together` reading is already
   * built on it. A second, fixed threshold here would mean pressing an era and
   * then choosing `close together` showed different seams for the same archive.
   */
  it('breaks exactly where the writer’s own rhythm says it does', () => {
    const entries = [...run('2019-01-01', 20), ...run('2021-06-01', 30)]
    const quiet = quietFor(entries)
    // Daily pages give a median gap of 1 day, so the silence bar sits at the
    // clamp floor of 14 — and the two-and-a-half-year gap clears it easily.
    expect(quiet).toBe(14)
    expect(eras(entries)).toHaveLength(2)
  })

  it('writes through a gap the writer would not call a silence', () => {
    // One missed fortnight inside a daily rhythm is not a seam.
    const entries = [...run('2019-01-01', 20), ...run('2019-02-01', 20)]
    expect(eras(entries)).toEqual([])
  })

  /*
   * THE BRACKET MUST NOT END IN BLANK MONTHS. An era runs to its last written
   * page, so pressing a chip never selects a tail of empty months the band can
   * plainly be seen to have.
   */
  it('runs from the first page to the last, never into the silence', () => {
    const entries = [...run('2019-01-01', 20), ...run('2021-06-01', 30)]
    const months = monthsAcross(entries)
    const [first] = erasFrom(entries, months)
    expect(months[first!.from]).toEqual({ year: 2019, month: 0 })
    expect(months[first!.to]).toEqual({ year: 2019, month: 0 })
  })

  /*
   * A stray page between two long silences is not a period of anybody's life.
   * The floor is `floorFor` — the same one page in a hundred the Life Map and
   * `look for` use — passed to `bursts` as its `min`.
   */
  it('drops a stretch carrying less than one page in a hundred', () => {
    const entries = [...run('2015-01-01', 300), ...run('2019-01-01', 2), ...run('2023-01-01', 300)]
    expect(eras(entries).map((e) => e.pages)).toEqual([300, 300])
  })

  /*
   * ONE ERA IS NO ERAS. A single chip bracketing everything is what "no bracket"
   * already means, and inventing a boundary to make a second one would be the
   * app drawing a line across a life it cannot see.
   */
  it('offers nothing when the writing never breaks', () => {
    expect(eras(run('2019-01-01', 200))).toEqual([])
  })

  it('offers nothing for an empty archive', () => {
    expect(erasFrom([], [])).toEqual([])
  })

  /*
   * NOTHING IS SORTED BY SIZE. A row of periods ordered by how much someone
   * wrote in each is a ranking of the seasons of their life (D-016).
   */
  it('keeps them chronological, never by size', () => {
    const entries = [...run('2015-01-01', 40), ...run('2019-01-01', 300), ...run('2023-01-01', 90)]
    expect(eras(entries).map((e) => e.pages)).toEqual([40, 300, 90])
  })
})

describe('eraLabel', () => {
  const months = [
    { year: 2018, month: 0 },
    { year: 2019, month: 5 },
    { year: 2020, month: 11 },
  ]

  it('names the years it spans, and nothing else about it', () => {
    expect(eraLabel({ from: 0, to: 2, pages: 9 }, months)).toBe('2018 – 2020')
  })

  it('says one year when that is all it is', () => {
    expect(eraLabel({ from: 1, to: 1, pages: 9 }, months)).toBe('2019')
  })
})
