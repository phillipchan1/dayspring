import { describe, expect, it } from 'vitest'
import type { Entry } from '@/lib/types'
import { buildSubjectIndex, matchSubject } from './subjects'
import { findSubject, passageFor, searchPages, spellingsOf, stem, vocabularyOf, within } from './textSearch'

const entry = (id: string, body: string): Entry =>
  ({ id, body_markdown: body, created_at: '2020-01-01T12:00:00Z' }) as unknown as Entry

const PAGES = [
  entry('exact', 'That year was a formative desert for me, and I did not know it.'),
  entry('apart', 'The desert season felt long. Looking back it was formative.'),
  entry('forms', 'A time of formation in the deserts of my own making.'),
  entry('far', `The desert. ${'Filler words go on and on here. '.repeat(10)} Formative, I think.`),
  entry('one', 'Only the desert today.'),
  entry('none', 'Nothing about it at all.'),
  entry(
    'prayer',
    ['Morning.', '```dayspring-pray 3f2504e0-4f89-11d3-9a0c-0305e82c3301', 'Lead me through this formative desert', '```'].join('\n'),
  ),
  entry(
    'verse',
    ['```dayspring-scripture 3f2504e0-4f89-11d3-9a0c-0305e82c3302', 'the formative desert of Sinai', 'Deut 8:2', '```'].join('\n'),
  ),
]
const index = buildSubjectIndex(PAGES)
const ids = (q: string) => searchPages(index, q).found.map((f) => `${f.id}:${f.closeness}`)

describe('searchPages', () => {
  it('ranks the exact phrase first, then close together, then same page', () => {
    expect(ids('formative desert')).toEqual([
      'exact:exact',
      'apart:near',
      'forms:near',
      'prayer:exact',
      'far:page',
    ].sort((a, b) => order(a) - order(b)))
  })

  it('finds words written inside a prayer, never inside a quoted verse', () => {
    const found = ids('formative desert')
    expect(found).toContain('prayer:exact')
    expect(found.some((f) => f.startsWith('verse'))).toBe(false)
  })

  it('falls back to some of the words only when nothing has them all', () => {
    const s = searchPages(index, 'desert wanderings')
    expect(s.lightable).toBe(0)
    expect(s.found.every((f) => f.closeness === 'some')).toBe(true)
    expect(s.found.map((f) => f.id)).toContain('one')
  })

  it('forgives a slip of one letter', () => {
    expect(ids('formatve')).toContain('exact:near')
  })

  it('finds an unfinished last word while typing', () => {
    const s = searchPages(index, 'formative des', true)
    expect(s.found[0]?.id).toBe('exact')
  })

  it('says nothing when nothing is there', () => {
    expect(searchPages(index, 'zebra crossing').found).toEqual([])
  })

  it('lights exactly what it counts', () => {
    const subject = findSubject(index, 'formative desert')!
    expect(matchSubject(index, subject).size).toBe(searchPages(index, 'formative desert').lightable)
  })
})

describe('passageFor', () => {
  it('shows the line that says it, with the words marked', () => {
    const s = searchPages(index, 'formative desert')
    const runs = passageFor(PAGES[0]!, s)
    expect(runs.filter((_, i) => i % 2 === 1).map((r) => r.toLowerCase())).toEqual(['formative', 'desert'])
  })
})

describe('spellings', () => {
  it('joins the forms of a word', () => {
    expect(stem('prayers')).toBe(stem('praying'))
    expect(stem('formative')).toBe(stem('formation'))
    const vocab = vocabularyOf(index)
    expect(spellingsOf('desert', vocab)).toContain('deserts')
  })

  it('bounds edit distance', () => {
    expect(within('desert', 'dessert', 1)).toBe(true)
    expect(within('desert', 'dissent', 1)).toBe(false)
  })
})

function order(s: string): number {
  return ['exact', 'near', 'page', 'some'].indexOf(s.split(':')[1]!) * 100 + PAGES.findIndex((p) => p.id === s.split(':')[0])
}
