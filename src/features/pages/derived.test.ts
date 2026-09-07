import { describe, expect, it } from 'vitest'
import { buildFacetIndex } from './facets'
import { buildSubjectIndex } from './subjects'
import { facetIndexFor, subjectIndexFor, warmPageIndexes } from './derived'
import type { Entry } from '@/lib/types'

let n = 0
function entry(bodyMarkdown: string, id = `e${++n}`): Entry {
  const iso = new Date(2026, 0, 1 + (n % 300)).toISOString()
  return {
    id, created_at: iso, updated_at: iso, body_markdown: bodyMarkdown,
    title: null, mood: null, tags: [], word_count: 10, source: 'native', external_id: null,
  }
}

const corpus = (): Entry[] => [
  entry('Reading Psalm 121 again this morning.'),
  entry('**Held it** lightly, and ==let it go==.'),
  entry('> a line I set apart, because it stayed'),
  entry('Nothing special today.'),
]

describe('the cached indexes', () => {
  // The caches are an optimisation and nothing else: whatever they hand back
  // has to be exactly what building from scratch would have.
  it('agree with an uncached build, every time', () => {
    const entries = corpus()
    for (let pass = 0; pass < 3; pass++) {
      expect(subjectIndexFor(entries)).toEqual(buildSubjectIndex(entries))
      expect(facetIndexFor(entries, [], [])).toEqual(buildFacetIndex(entries, [], []))
    }
  })

  /*
   * The case the cache exists for. The repo hands back a NEW object for an
   * entry on every local edit, and a new array for the corpus — so keying on
   * object identity would miss on the one change that matters most: you wrote
   * one page, and the other three thousand are untouched.
   */
  it('survives a fresh array of the same pages', () => {
    const entries = corpus()
    const first = facetIndexFor(entries, [], [])
    const again = facetIndexFor(entries.map((e) => ({ ...e })), [], [])
    expect(again).toEqual(first)
  })

  it('re-derives a page whose text changed, and agrees with a cold build', () => {
    const entries = corpus()
    facetIndexFor(entries, [], [])
    const edited = entries.map((e, i) =>
      i === 3 ? { ...e, body_markdown: 'Reading John 3:16 tonight.' } : { ...e },
    )
    const after = facetIndexFor(edited, [], [])
    expect(after).toEqual(buildFacetIndex(edited, [], []))
    expect(after.byEntry.get(edited[3]!.id)?.has('scripture')).toBe(true)
  })

  /*
   * Marks and markings come from their own tables and change without the
   * document changing at all, so only the document-derived half is cached.
   * Caching the whole index would mean choosing a prayer pill and seeing the
   * wall light by yesterday's answer.
   */
  it('layers marks and markings on fresh every time', () => {
    const entries = corpus()
    facetIndexFor(entries, [], [])
    const withMark = facetIndexFor(entries, [entries[0]!.id], [
      { entryId: entries[1]!.id, type: 'prayer', declared: false },
    ])
    expect(withMark.byEntry.get(entries[0]!.id)?.has('mark')).toBe(true)
    expect(withMark.byEntry.get(entries[1]!.id)?.has('prayer')).toBe(true)
    // And they come straight back off again.
    expect(facetIndexFor(entries, [], []).byEntry.get(entries[0]!.id)?.has('mark')).toBe(false)
  })
})

describe('warmPageIndexes', () => {
  it('fills the caches, so the first visit costs what a second one does', async () => {
    const entries = corpus()
    warmPageIndexes(entries)
    await new Promise((r) => setTimeout(r, 30))
    expect(facetIndexFor(entries, [], [])).toEqual(buildFacetIndex(entries, [], []))
  })

  it('hands back a cancel that stops the work, and is safe to call twice', () => {
    const stop = warmPageIndexes(corpus())
    expect(() => {
      stop()
      stop()
    }).not.toThrow()
  })

  it('does nothing at all on an empty archive', () => {
    expect(() => warmPageIndexes([])()).not.toThrow()
  })
})
