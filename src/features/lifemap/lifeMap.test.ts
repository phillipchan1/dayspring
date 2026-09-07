import { describe, it, expect } from 'vitest'
import type { ConcordanceItem } from '@/lib/concordance'
import type { KeptSubject } from '@/features/pages/keptSubjects'
import { buildLifeMap, provenanceOf, sectionFor, conKey, tallies, floorFor, eraOf } from './lifeMap'

const item = (over: Partial<ConcordanceItem> & { canonical: string }): ConcordanceItem => ({
  id: over.canonical,
  kind: 'person',
  surface_forms: [],
  descriptor: null,
  status: 'suggested',
  source: 'repetition',
  // Above the default floor of 3, so a fixture is offered unless a test says otherwise.
  occurrence_count: 5,
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

  it('makes a kept row the writer\'s own', () => {
    const it_ = item({ canonical: 'Marcus' })
    expect(provenanceOf(it_, none)).toBe('found')
    expect(provenanceOf(it_, new Set([conKey('Marcus')]))).toBe('mine')
  })

  it('takes what Dayspring found as in by default — nothing waits to be confirmed', () => {
    // The old third state cost 341 decisions before the surface did anything.
    // Removing one wrong name is cheaper than confirming three hundred right ones.
    expect(provenanceOf(item({ canonical: 'Naomi' }), none)).toBe('found')
  })
})

describe('floorFor', () => {
  it('is one page in a hundred, the WORD_FLOOR constant', () => {
    expect(floorFor(2969)).toBe(30)
    expect(floorFor(10000)).toBe(100)
  })

  it('never falls below three, so a young journal offers something', () => {
    expect(floorFor(0)).toBe(3)
    expect(floorFor(47)).toBe(3)
  })
})

describe('eraOf', () => {
  it('files a dormant find under earlier', () => {
    expect(eraOf('found', true)).toBe('earlier')
  })

  it("keeps the writer's own current, however quiet it has gone", () => {
    // Vera must never drift into "earlier" for going quiet — that is the app
    // appearing to forget someone's wife.
    expect(eraOf('mine', true)).toBe('current')
  })

  it('keeps a recent find current', () => {
    expect(eraOf('found', false)).toBe('current')
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
    // The writer's own meet the eye first; both are in either way.
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Vera', 'Marcus'])
    expect(section('domain', out).items).toHaveLength(2)
    // Vera is the writer's; Marcus is not.
    expect(section('person', out).found).toBe(1)
  })

  it('never offers the One the journal is addressed to', () => {
    // Assumed, not noticed. "Jesus" lights 2,914 pages of 3,571 — lighting it
    // dims nothing, so it is not a way of looking at anything.
    const out = buildLifeMap(
      [
        item({ canonical: 'Jesus', occurrence_count: 2914 }),
        item({ canonical: 'the Lord', occurrence_count: 1800 }),
        item({ canonical: 'Holy Spirit', occurrence_count: 2832 }),
        item({ canonical: 'Mom' }),
      ],
      [],
    )
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Mom'])
  })

  it('still offers Father, which is a real person at least as often', () => {
    const out = buildLifeMap([item({ canonical: 'Father' })], [])
    expect(section('person', out).items).toHaveLength(1)
  })

  it('keeps dormant rows and hides only superseded ones', () => {
    // Dormant is "no occurrence in a year" — recency, not retirement. On a
    // fifteen-year archive it is most of the people in it, and absence is
    // exactly what the silence move reads.
    const out = buildLifeMap(
      [
        item({ canonical: 'Ben', status: 'dormant' }),
        item({ canonical: 'Bennie', status: 'superseded' }),
        item({ canonical: 'Danny', status: 'confirmed' }),
      ],
      [],
    )
    // Danny is confirmed, Ben is a dormant suggestion — so Ben sorts last as
    // waiting, but he is still here.
    // Danny is confirmed so he stays current; Ben is a dormant suggestion, so
    // he is filed under `earlier` rather than dropped.
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Danny'])
    expect(section('person', out).earlier.map((i) => i.label)).toEqual(['Ben'])
    expect(section('person', out).earlier[0]!.dormant).toBe(true)
  })

  it('offers nothing below the floor', () => {
    const out = buildLifeMap(
      [
        item({ canonical: 'Rare', occurrence_count: 2 }),
        item({ canonical: 'Often', occurrence_count: 30 }),
      ],
      [],
      12,
    )
    expect(section('person', out).items.map((i) => i.label)).toEqual(['Often'])
  })

  it('exempts anything the writer answered from the floor', () => {
    // A kept name must never vanish because it stopped recurring. That would be
    // arithmetic overruling the writer.
    const out = buildLifeMap(
      [
        item({ canonical: 'Ben', occurrence_count: 1 }),
        item({ canonical: 'Mom', occurrence_count: 1, source: 'explicit' }),
      ],
      [kept(conKey('Ben'), 'Ben')],
      12,
    )
    expect(section('person', out).items.map((i) => i.label).sort()).toEqual(['Ben', 'Mom'])
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
    expect(tallies(out)).toEqual({ mine: 1, found: 2 })
  })

  it('counts earlier items in the tallies, since filed is not gone', () => {
    const out = buildLifeMap(
      [item({ canonical: 'Ruth', status: 'dormant' }), item({ canonical: 'Vera', source: 'explicit' })],
      [],
    )
    expect(section('person', out).items).toHaveLength(1)
    expect(section('person', out).earlier).toHaveLength(1)
    expect(tallies(out)).toEqual({ mine: 1, found: 1 })
  })

  it('returns all four sections even when the journal is blank', () => {
    const out = buildLifeMap([], [])
    expect(out).toHaveLength(4)
    expect(out.every((s) => s.items.length === 0 && s.earlier.length === 0)).toBe(true)
    expect(out.map((s) => s.ask)).toEqual([
      'add a name…',
      'add a place…',
      'add a domain…',
      "add what's going on…",
    ])
  })
})
