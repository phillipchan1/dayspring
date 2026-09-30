import { describe, expect, it } from 'vitest'
import { RITUAL_END_TOKEN } from '@/lib/practiceTokens'
import type { Entry } from '@/lib/types'
import { writePassage, type PassageRef } from './passage'
import { bibleResume, nextChapter } from './passageResume'
import { PRACTICE_BY_NAME } from './practicesData'
import { composeRitualMarkdown } from './ritualDocument'

const ID = '7c1e0b52-9a0b-4f1e-8c3d-2b6a1f0e9d44'

function entry(id: string, at: string, body: string): Entry {
  return {
    id,
    created_at: at,
    updated_at: at,
    body_markdown: body,
    title: null,
    mood: null,
    tags: [],
    word_count: 0,
    source: 'native',
    external_id: null,
  } as Entry
}

function ritualPage(name: string, ref: PassageRef, own = false): string {
  const practice = PRACTICE_BY_NAME.get(name)!
  const labels = practice.prompts.map((p) => p.label)
  const verses = own ? null : [{ n: ref.from ?? 1, text: 'Remain in me, and I in you.' }]
  const texts = labels.map((_, n) => (n === 0 ? writePassage(ref, verses, ID) : n === 1 ? 'A word.' : ''))
  return `${composeRitualMarkdown(name, labels, texts)}\n${RITUAL_END_TOKEN}`
}

describe('nextChapter', () => {
  it('turns the page within a book', () => {
    expect(nextChapter({ book: 'John', chapter: 15, from: 4, to: 5 })).toEqual({
      book: 'John',
      chapter: 16,
      from: null,
      to: null,
    })
  })

  it('runs on into the next book, and stops after Revelation', () => {
    expect(nextChapter({ book: 'Genesis', chapter: 50, from: null, to: null })).toEqual({
      book: 'Exodus',
      chapter: 1,
      from: null,
      to: null,
    })
    expect(nextChapter({ book: 'Revelation', chapter: 22, from: null, to: null })).toBeNull()
  })
})

describe('bibleResume', () => {
  it('picks up after the newest scripture ritual, in the same practice', () => {
    const r = bibleResume([
      entry('a', '2026-09-20T08:00:00Z', ritualPage('Open Reading', { book: 'Mark', chapter: 3, from: null, to: null })),
      entry('b', '2026-09-28T08:00:00Z', ritualPage('Lectio Divina', { book: 'John', chapter: 15, from: 4, to: 5 })),
      entry('c', '2026-09-29T08:00:00Z', 'Just a page, no ritual.'),
    ])
    expect(r?.practice.name).toBe('Lectio Divina')
    expect(r?.ref).toEqual({ book: 'John', chapter: 16, from: null, to: null })
  })

  it('goes on from a passage read in the writer’s own Bible', () => {
    const r = bibleResume([
      entry('a', '2026-09-20T08:00:00Z', ritualPage('SOAP', { book: 'Psalms', chapter: 23, from: null, to: null }, true)),
    ])
    expect(r?.ref).toEqual({ book: 'Psalms', chapter: 24, from: null, to: null })
  })

  it('ignores rituals that carry no passage', () => {
    const examen = PRACTICE_BY_NAME.get('The Daily Examen')!
    const labels = examen.prompts.map((p) => p.label)
    const md = `${composeRitualMarkdown(examen.name, labels, labels.map(() => 'x'))}\n${RITUAL_END_TOKEN}`
    expect(bibleResume([entry('a', '2026-09-20T08:00:00Z', md)])).toBeNull()
  })

  it('offers nothing to someone who has never opened a passage', () => {
    expect(bibleResume([])).toBeNull()
  })
})
