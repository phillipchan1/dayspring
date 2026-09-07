import { describe, expect, it } from 'vitest'
import { LIVE_MARK_KINDS } from '@/lib/markKinds'
import type { Entry } from '@/lib/types'
import {
  buildFacetIndex,
  markingChips,
  FACET_PRAYER,
  FACET_RITUAL,
  FACET_SENSE,
  FACET_BOLD,
  FACET_HIGHLIGHT,
  FACET_MARK,
  FACET_QUOTE,
  FACET_SCRIPTURE,
  FACET_UNDERLINE,
  bookFacet,
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

  /**
   * The distinction that matters, now that a /scripture block counts as a
   * citation: the block itself is something the writer did, but the VERSE TEXT
   * inside it is the Bible's words. A psalm that happens to name another book
   * must not make this page a page about that book.
   */
  it('does not read book references out of a pasted verse', () => {
    const body = [
      'nothing else cited here',
      '```dayspring-scripture 3f2504e0-4f89-11d3-9a0c-0305e82c3301',
      'as it is written in Isaiah 40:3 and in Malachi 3:1',
      'Mark 1:2',
      '```',
    ].join('\n')
    const set = facetsOf(body).set
    expect(set.has(FACET_SCRIPTURE)).toBe(true) // they ran the command
    expect(set.has(bookFacet('Isa'))).toBe(false) // the psalm's words, not theirs
    expect(set.has(bookFacet('Mal'))).toBe(false)
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

describe('the slash blocks — what the writer put on the page', () => {
  const block = (type: string, body: string) =>
    ['```dayspring-' + type + ' 3f2504e0-4f89-11d3-9a0c-0305e82c3301', body, '```'].join('\n')

  it('finds a prayer, a sense and a ritual', () => {
    expect(facetsOf(block('pray', 'for Dad on Thursday')).set.has(FACET_PRAYER)).toBe(true)
    expect(facetsOf(block('sense', 'that it would hold')).set.has(FACET_SENSE)).toBe(true)
    expect(facetsOf('<!-- ritual:name:Morning -->\nsomething').set.has(FACET_RITUAL)).toBe(true)
  })

  // Citing a verse by typing it and citing it with the command are the same act
  // to the person who did it, whatever the storage says.
  it('counts a /scripture block as scripture', () => {
    const set = facetsOf(block('scripture', 'He will keep your going out\nPsalm 121:8')).set
    expect(set.has(FACET_SCRIPTURE)).toBe(true)
  })

  it('does not see a prayer where there is only prose about praying', () => {
    expect(facetsOf('I prayed about it for a while').set.has(FACET_PRAYER)).toBe(false)
  })
})

describe('markingChips', () => {
  // The set is closed and the same every time. A list that silently changes
  // length teaches the reader that the vocabulary is variable, which is the
  // beginning of a tag manager.
  it('offers the six, and never a retired kind', () => {
    const chips = markingChips(buildFacetIndex([entry('just plain prose')]))
    expect(chips.map((c) => c.kind)).toEqual(LIVE_MARK_KINDS.map((k) => k.kind))
    expect(chips.every((c) => c.count === 0)).toBe(true)
  })

  it('counts the pages a kind would give you', () => {
    const pray = (body: string) =>
      entry(['```dayspring-pray 3f2504e0-4f89-11d3-9a0c-0305e82c3301', body, '```'].join('\n'))
    const chips = markingChips(buildFacetIndex([pray('for Thursday'), pray('for Ben'), entry('plain')]))
    expect(chips.find((c) => c.kind === 'prayer')!.count).toBe(2)
  })

  /*
   * The defect this whole path exists for: reading only the fences finds 7
   * pages with a prayer on a fifteen-year imported archive instead of 2,361,
   * because the markings are a Dayspring gesture and the pages predate it.
   */
  it('counts a harvested prayer the same as a typed one', () => {
    const page = entry('I keep bringing her and I keep not knowing what to ask for.')
    const chips = markingChips(
      buildFacetIndex([page], [], [{ entryId: page.id, type: 'prayer', declared: false }]),
    )
    expect(chips.find((c) => c.kind === 'prayer')!.count).toBe(1)
  })

  // ONE pill per kind, not two. Whichever way a page came by its prayer, it is
  // a page with a prayer on it.
  it('does not count a page twice when it has the marking both ways', () => {
    const page = entry(
      ['```dayspring-pray 3f2504e0-4f89-11d3-9a0c-0305e82c3301', 'for Ben', '```'].join('\n'),
    )
    const chips = markingChips(
      buildFacetIndex([page], [], [{ entryId: page.id, type: 'prayer', declared: false }]),
    )
    expect(chips.find((c) => c.kind === 'prayer')!.count).toBe(1)
  })
})

describe('retired kinds', () => {
  // Cut from the vocabulary, kept for the pages that already carry them. An
  // entry marked `gift` in June must still render as a gift.
  it('never offers Gift or Absence', () => {
    const chips = markingChips(buildFacetIndex([entry('plain')]))
    expect(chips.map((c) => c.kind)).not.toContain('gift')
    expect(chips.map((c) => c.kind)).not.toContain('absence')
    expect(chips).toHaveLength(6)
  })

  it('still indexes a page that carries one', () => {
    const page = entry('something I was given')
    const index = buildFacetIndex([page], [], [{ entryId: page.id, type: 'gift', declared: false }])
    expect(index.byEntry.get(page.id)!.has('gift')).toBe(true)
  })
})
