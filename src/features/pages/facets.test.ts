import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import {
  buildFacetIndex,
  facetChips,
  FACET_BOLD,
  FACET_HIGHLIGHT,
  FACET_MARK,
  FACET_QUOTE,
  FACET_SCRIPTURE,
  FACET_UNDERLINE,
  highlightFacet,
  matchFacets,
} from './facets'

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
    word_count: 10,
    source: 'native',
    external_id: null,
  }
}

const facetsOf = (body: string, marked = false) => {
  const e = entry(body)
  const idx = buildFacetIndex([e], marked ? [e.id] : [])
  return { set: idx.byEntry.get(e.id)!, id: e.id, idx }
}

describe('buildFacetIndex', () => {
  it('finds each kind of thing the writer did', () => {
    expect(facetsOf('a ==bright== line').set.has(FACET_HIGHLIGHT)).toBe(true)
    expect(facetsOf('a ++kept++ line').set.has(FACET_UNDERLINE)).toBe(true)
    expect(facetsOf('a **strong** line').set.has(FACET_BOLD)).toBe(true)
    expect(facetsOf('> a quoted line').set.has(FACET_QUOTE)).toBe(true)
    expect(facetsOf('reading Psalm 121 today').set.has(FACET_SCRIPTURE)).toBe(true)
    expect(facetsOf('anything', true).set.has(FACET_MARK)).toBe(true)
  })

  it('records which colour the highlight was', () => {
    expect(facetsOf('a ==plain== one').set.has(highlightFacet('amber'))).toBe(true)
    expect(facetsOf('a =={rose}pink== one').set.has(highlightFacet('rose'))).toBe(true)
    expect(facetsOf('a =={rose}pink== one').set.has(highlightFacet('amber'))).toBe(false)
  })

  // The same reason the shared stripper is pair-aware: a search for `==` or `++`
  // turns arithmetic and a language name into markings.
  it('does not mistake ordinary punctuation for a marking', () => {
    const set = facetsOf('2+2=4 and I still write C++ and x == y').set
    expect(set.has(FACET_HIGHLIGHT)).toBe(false)
    expect(set.has(FACET_UNDERLINE)).toBe(false)
  })

  // A pasted psalm is the Bible's words, not a citation the writer made.
  it('reads scripture from the writer’s prose, not from a /scripture block', () => {
    const body = [
      'nothing cited here',
      '```dayspring-scripture 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'He will keep your going out and your coming in',
      'Psalm 121:8',
      '```',
    ].join('\n')
    expect(facetsOf(body).set.has(FACET_SCRIPTURE)).toBe(false)
  })

  it('counts each facet once per page, however many times it appears', () => {
    const e = entry('==one== and ==two== and ==three==')
    const idx = buildFacetIndex([e])
    expect(idx.counts.get(FACET_HIGHLIGHT)).toBe(1)
  })
})

describe('matchFacets', () => {
  const both = entry('a ==bright== line about Psalm 23')
  const onlyHl = entry('a ==bright== line')
  const idx = buildFacetIndex([both, onlyHl])

  it('is silent when nothing is chosen, so the wall stays whole', () => {
    expect(matchFacets(idx, [])).toBeNull()
  })

  // AND, not OR. Adding a filter has to narrow, or every choice hands back a
  // bigger pile than you started with.
  it('narrows as filters are added', () => {
    expect(matchFacets(idx, [FACET_HIGHLIGHT])!.size).toBe(2)
    expect([...matchFacets(idx, [FACET_HIGHLIGHT, FACET_SCRIPTURE])!]).toEqual([both.id])
  })
})

describe('facetChips', () => {
  it('offers nothing for an archive with no markings in it', () => {
    expect(facetChips(buildFacetIndex([entry('just plain prose')]))).toEqual([])
  })

  // A control that reports zero is a worse answer than no control.
  it('offers only the facets some page actually carries', () => {
    const chips = facetChips(buildFacetIndex([entry('a =={sky}blue== line')]))
    const keys = chips.map((c) => c.key)
    expect(keys).toContain(FACET_HIGHLIGHT)
    expect(keys).toContain(highlightFacet('sky'))
    expect(keys).not.toContain(highlightFacet('rose'))
    expect(keys).not.toContain(FACET_SCRIPTURE)
  })
})
