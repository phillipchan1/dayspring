import { describe, it, expect } from 'vitest'
import type { ConcordanceItem } from '@/lib/concordance'
import type { KeptSubject } from '@/features/pages/keptSubjects'
import { buildLifeMap, provenanceOf, sectionFor, conKey, tallies } from './lifeMap'

const item = (over: Partial<ConcordanceItem> & { canonical: string }): ConcordanceItem => ({
  id: over.canonical,
  kind: 'person',
  surface_forms: [],
  descriptor: null,
  status: 'suggested',
  source: 'repetition',
  occurrence_count: 1,
  first_seen: '2020-01-01T00:00:00Z',
  last_seen: '2026-01-01T00:00:00Z',
  ...over,
})

const kept = (key: string, label: string, over: Partial<KeptSubject> = {}): KeptSubject =>
  ({
    key,
    label,
    terms: [label],
    kind: key.startsWith('word:') ? 'word' : 'term',
    keptAt: '2026-01-01T00:00:00Z',
    ...over,
  }) as KeptSubject

const section = (id: string, out: ReturnType<typeof buildLifeMap>) =>
  out.find((s) => s.id === id)!

describe('sectionFor', () => {
  it('unions org and project into one Domains section', () => {
    expect(sectionFor('org')).toBe('domain')
    expect(sectionFor('project')).toBe('domain')
  })

  it('maps the other three straight through', () => {
    expect(sectionFor('person')).toBe('person')
    expect(sectionFor('place')).toBe('place')
    expect(sectionFor('term')).toBe('matter')
  })
})

describe('provenanceOf', () => {
  const none = new Set<string>()

  it('calls a writer-created row mine even once the engine confirmed it', () => {
    // The check order is the point: status-first would relabel every typed
    // subject as something the machine found.
    const it_ = item({ canonical: 'Vera', source: 'explicit', status: 'confirmed' })
    expect(provenanceOf(it_, none)).toBe('mine')
  })

  it('treats a correction as the writer speaking, not the engine', () => {
    expect(provenanceOf(item({ canonical: 'Esther', source: 'correction' }), none)).toBe('mine')
  })

  it('calls a confirmed row found', () => {
    expect(provenanceOf(item({ canonical: 'Marcus', status: 'confirmed' }), none)).toBe('found')
  })

  it('promotes a suggested row to found once it is kept', () => {
    const it_ = item({ canonical: 'Marcus' })
    expect(provenanceOf(it_, none)).toBe('waiting')
    expect(provenanceOf(it_, new Set([conKey('Marcus')]))).toBe('found')
  })

  it('leaves an unanswered suggestion waiting', () => {
    expect(provenanceOf(item({ canonical: 'Naomi' }), none)).toBe('waiting')
  })
})

describe('buildLifeMap', () => {
  it('files every kind into its section and counts what was found', () => {
    const out = buildLifeMap(
      [
        item({ canonical: 'Vera', kind: 'person', source: 'explicit' }),
        item({ canonical: 'Marcus', kind: 'person', status: 'confirmed' }),
        item({ canonical: 'home', kind: 'place', status: 'confirmed' }),
        item({ canonical: 'Frontier', kind: 'org', status: 'confirmed' }),
        item({ canonical: 'Dayspring', kind: 'project', source: 'explicit' }),
        item({ canonical: 'burning out', kind: 'term' }),
      ],
      [],
    )
    expect(out.map((s) => s.id)).toEqual(['person', 'place', 'domain', 'matter'])
    // Equal first_seen, so they tie and fall through to alphabetical. Typed and
    // found sort together on purpose: separating them would rank the writer's
    // own names above the ones the journal surfaced.
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Marcus', 'Vera'])
    expect(section('domain', out).items).toHaveLength(2)
    // Vera is the writer's; Marcus is not.
    expect(section('person', out).found).toBe(1)
  })

  it('hides dormant and superseded rows', () => {
    const out = buildLifeMap(
      [
        item({ canonical: 'Ben', status: 'dormant' }),
        item({ canonical: 'Bennie', status: 'superseded' }),
        item({ canonical: 'Danny', status: 'confirmed' }),
      ],
      [],
    )
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Danny'])
  })

  it('carries typed subjects the engine has never seen', () => {
    const out = buildLifeMap([], [kept('word:the move', 'the move')])
    const m = section('matter', out).items
    expect(m).toHaveLength(1)
    expect(m[0]!).toMatchObject({ label: 'the move', provenance: 'mine', pages: 0 })
  })

  it('does not double-count a typed subject the engine later learned', () => {
    const out = buildLifeMap(
      [item({ canonical: 'Vera', source: 'explicit' })],
      [kept(conKey('Vera'), 'Vera')],
    )
    expect(section('person', out).items).toHaveLength(1)
  })

  it('sorts waiting items after answered ones, and never by page count', () => {
    // Riverside has more pages than Mom. It must not outrank her.
    const out = buildLifeMap(
      [
        item({
          canonical: 'Riverside',
          kind: 'place',
          occurrence_count: 31,
          first_seen: '2024-01-01T00:00:00Z',
        }),
        item({
          canonical: 'home',
          kind: 'place',
          status: 'confirmed',
          occurrence_count: 14,
          first_seen: '2012-01-01T00:00:00Z',
        }),
      ],
      [],
    )
    const places = section('place', out).items
    // "Home" — displayLabel repairs a lowercase canonical for display.
    expect(places.map((i) => i.label)).toEqual(['Home', 'Riverside'])
    expect(places[0]!.pages).toBeLessThan(places[1]!.pages)
  })

  it('still shows the count it refuses to sort by', () => {
    const out = buildLifeMap([item({ canonical: 'Mom', occurrence_count: 132 })], [])
    expect(section('person', out).items[0]!.pages).toBe(132)
  })

  it('tallies the three provenances', () => {
    const out = buildLifeMap(
      [
        item({ canonical: 'Vera', source: 'explicit' }),
        item({ canonical: 'Marcus', status: 'confirmed' }),
        item({ canonical: 'Naomi' }),
      ],
      [],
    )
    expect(tallies(out)).toEqual({ mine: 1, found: 1, waiting: 1 })
  })

  it('returns all four sections even when the journal is blank', () => {
    const out = buildLifeMap([], [])
    expect(out).toHaveLength(4)
    expect(out.every((s) => s.items.length === 0)).toBe(true)
    expect(out.map((s) => s.ask)).toEqual([
      'add a name…',
      'add a place…',
      'add a domain…',
      "add what's going on…",
    ])
  })
})
