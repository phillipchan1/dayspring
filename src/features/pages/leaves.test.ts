import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { LeafCounter, leavesFor, leavesForEntry, linesForParagraph } from './leaves'

let n = 0
function entry(body: string): Entry {
  const iso = new Date(2024, 5, 10, 12).toISOString()
  return {
    id: `e${++n}`,
    created_at: iso,
    updated_at: iso,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: body.split(/\s+/).length,
    source: 'native',
    external_id: null,
  }
}

// jsdom has no real canvas, so this exercises the fallback path — which is
// exactly what a server render and a test run both take.
const metrics = { width: 400, linesPerLeaf: 10, font: '16px serif' }

describe('linesForParagraph', () => {
  it('gives an empty line one line rather than none', () => {
    expect(linesForParagraph('', 400, '16px serif')).toBe(1)
    expect(linesForParagraph('   ', 400, '16px serif')).toBe(1)
  })

  it('never returns less than one line for real text', () => {
    expect(linesForParagraph('short', 400, '16px serif')).toBeGreaterThanOrEqual(1)
  })

  it('needs more lines as the column narrows', () => {
    const text = 'a fairly ordinary sentence of the kind someone writes in a journal most mornings'
    const wide = linesForParagraph(text, 4000, '16px serif')
    const narrow = linesForParagraph(text, 40, '16px serif')
    expect(narrow).toBeGreaterThanOrEqual(wide)
  })
})

describe('leavesForEntry', () => {
  it('gives a short page exactly one leaf', () => {
    expect(leavesForEntry(entry('one short line'), metrics)).toBe(1)
  })

  it('gives an empty page one leaf rather than none', () => {
    expect(leavesForEntry(entry(''), metrics)).toBe(1)
  })

  // A page in a book fills and continues; it does not become a viewport.
  it('runs a long page onto more than one leaf', () => {
    const long = Array.from({ length: 40 }, (_, i) => `paragraph number ${i} with some words in it`).join('\n\n')
    expect(leavesForEntry(entry(long), metrics)).toBeGreaterThan(1)
  })

  it('needs more leaves as the leaf gets shorter', () => {
    const long = Array.from({ length: 30 }, (_, i) => `paragraph ${i}`).join('\n\n')
    const roomy = leavesForEntry(entry(long), { ...metrics, linesPerLeaf: 30 })
    const tight = leavesForEntry(entry(long), { ...metrics, linesPerLeaf: 5 })
    expect(tight).toBeGreaterThan(roomy)
  })
})

describe('leavesFor', () => {
  /*
   * The property the whole surface rests on. A 3,580-page archive windows
   * cleanly because every cell is the same height — so a long page becomes a
   * variable NUMBER of fixed-size leaves, never a variable-size cell.
   */
  it('lays every page out as whole leaves, in order', () => {
    const a = entry('short')
    const b = entry(Array.from({ length: 40 }, (_, i) => `para ${i} with several words`).join('\n\n'))
    const c = entry('also short')
    const leaves = leavesFor([a, b, c], metrics, new LeafCounter())

    expect(leaves[0]).toMatchObject({ entry: a, index: 0, of: 1 })
    expect(leaves.at(-1)).toMatchObject({ entry: c, index: 0, of: 1 })
    // Every leaf of a page knows how many there are, so only the first prints a
    // date — that absence is the whole continuation cue.
    const bLeaves = leaves.filter((l) => l.entry === b)
    expect(bLeaves.length).toBeGreaterThan(1)
    expect(bLeaves.every((l) => l.of === bLeaves.length)).toBe(true)
    expect(bLeaves.map((l) => l.index)).toEqual(bLeaves.map((_, i) => i))
  })

  it('keeps the pages in the order it was given them', () => {
    const list = [entry('one'), entry('two'), entry('three')]
    const leaves = leavesFor(list, metrics, new LeafCounter())
    expect(leaves.map((l) => l.entry.id)).toEqual(list.map((e) => e.id))
  })
})

describe('LeafCounter', () => {
  it('measures a page once per geometry', () => {
    const counter = new LeafCounter()
    const e = entry('a page with a few words on it')
    expect(counter.count(e, metrics)).toBe(counter.count(e, metrics))
  })

  // Resizing has to re-measure, or the scroller and the rendering disagree.
  it('re-measures when the geometry changes', () => {
    const counter = new LeafCounter()
    const long = entry(Array.from({ length: 30 }, (_, i) => `para ${i}`).join('\n\n'))
    const roomy = counter.count(long, { ...metrics, linesPerLeaf: 30 })
    const tight = counter.count(long, { ...metrics, linesPerLeaf: 4 })
    expect(tight).toBeGreaterThan(roomy)
  })
})
