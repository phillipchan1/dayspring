import { describe, expect, it } from 'vitest'
import type { ConcordanceItem } from '@/lib/concordance'
import type { KeptSubject } from '@/features/pages/keptSubjects'
import { buildLifeMap } from './lifeMap'
import type { LifeMap } from './useLifeMap'
import { typedItem, typedKey, withRestored, withTyped, withoutItem } from './lifeMapEdits'

const con = (canonical: string, over: Partial<ConcordanceItem> = {}): ConcordanceItem => ({
  id: canonical,
  kind: 'person',
  canonical,
  surface_forms: [],
  descriptor: null,
  status: 'suggested',
  source: 'repetition',
  occurrence_count: 5,
  first_seen: '2020-01-01T00:00:00Z',
  last_seen: '2026-01-01T00:00:00Z',
  ...over,
})

const kept = (label: string, keptAt: string): KeptSubject =>
  ({ key: `word:${label}`, label, terms: [label], kind: 'word', section: 'person', keptAt }) as KeptSubject

function fixture(): LifeMap {
  const sections = buildLifeMap(
    [
      con('Tiffany', { first_seen: '2019-01-01T00:00:00Z' }),
      con('Mom', { first_seen: '2018-01-01T00:00:00Z' }),
      con('Riverside', { kind: 'place' }),
      con('Old friend', { status: 'dormant' }),
    ],
    [kept('Vera', '2025-03-01T00:00:00Z')],
  )
  return { sections, floor: 3, pages: 300 }
}

const people = (m: LifeMap) => m.sections.find((s) => s.id === 'person')!
const labels = (m: LifeMap) => people(m).items.map((i) => i.label)

describe('withoutItem', () => {
  it('takes the item off at once, and says where it was', () => {
    const map = fixture()
    const { map: next, removed } = withoutItem(map, 'c:tiffany')
    expect(labels(next)).not.toContain('Tiffany')
    expect(removed?.section).toBe('person')
    expect(removed?.list).toBe('items')
    expect(removed?.item.label).toBe('Tiffany')
  })

  it('keeps the found count honest', () => {
    const map = fixture()
    const before = people(map).found
    expect(people(withoutItem(map, 'c:tiffany').map).found).toBe(before - 1)
  })

  it('reaches the earlier list too', () => {
    const { removed } = withoutItem(fixture(), 'c:old friend')
    expect(removed?.list).toBe('earlier')
  })

  it('never touches the map it was given — that is what a rollback restores', () => {
    const map = fixture()
    const snapshot = JSON.stringify(labels(map))
    withoutItem(map, 'c:tiffany')
    expect(JSON.stringify(labels(map))).toBe(snapshot)
  })

  it('is a no-op for a key that is not there', () => {
    const map = fixture()
    const out = withoutItem(map, 'c:nobody')
    expect(out.map).toBe(map)
    expect(out.removed).toBeNull()
  })
})

describe('withRestored (Undo, or a failed write)', () => {
  it('puts the item back exactly where it was', () => {
    const map = fixture()
    const { map: gone, removed } = withoutItem(map, 'c:tiffany')
    expect(labels(withRestored(gone, removed!))).toEqual(labels(map))
    expect(people(withRestored(gone, removed!)).found).toBe(people(map).found)
  })

  it('does not double an item that is already back', () => {
    const map = fixture()
    const { removed } = withoutItem(map, 'c:tiffany')
    expect(labels(withRestored(map, removed!))).toEqual(labels(map))
  })
})

describe('withTyped', () => {
  it('shows a typed name at once, with the writer’s own names and after the older ones', () => {
    const map = fixture()
    const next = withTyped(map, typedItem('  Esther ', 'person', '2026-06-01T00:00:00Z'))
    const l = labels(next)
    expect(l).toContain('Esther')
    // Mine first (Vera, then Esther, kept later), then what was found.
    expect(l.indexOf('Vera')).toBeLessThan(l.indexOf('Esther'))
    expect(l.indexOf('Esther')).toBeLessThan(l.indexOf('Mom'))
  })

  it('matches what the server will hand back for the same row, so nothing jumps', () => {
    const at = '2026-06-01T00:00:00Z'
    const optimistic = withTyped(fixture(), typedItem('Esther', 'person', at))
    const server = buildLifeMap(
      [
        con('Tiffany', { first_seen: '2019-01-01T00:00:00Z' }),
        con('Mom', { first_seen: '2018-01-01T00:00:00Z' }),
        con('Riverside', { kind: 'place' }),
        con('Old friend', { status: 'dormant' }),
      ],
      [kept('Vera', '2025-03-01T00:00:00Z'), kept('Esther', at)],
    )
    expect(labels(optimistic)).toEqual(server.find((s) => s.id === 'person')!.items.map((i) => i.label))
  })

  it('keys it the way addTyped stores it', () => {
    expect(typedItem(' Esther ', 'person', '').key).toBe(typedKey('Esther'))
    expect(typedKey('Esther')).toBe('word:Esther')
  })

  it('leaves the map alone for a name already on it', () => {
    const map = fixture()
    expect(withTyped(map, typedItem('tiffany', 'person', '2026-06-01T00:00:00Z'))).toBe(map)
  })
})
