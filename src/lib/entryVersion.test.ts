import { describe, expect, it } from 'vitest'
import { maxUpdatedAt, shouldAdoptServerRow } from './entryVersion'
import type { Entry } from './types'

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id: 'e1',
    created_at: '2026-07-01T00:00:00.000Z',
    updated_at: '2026-07-01T00:00:00.000Z',
    body_markdown: 'body',
    title: null,
    mood: null,
    tags: [],
    word_count: 1,
    source: 'native',
    external_id: null,
    ...over,
  }
}

describe('shouldAdoptServerRow', () => {
  it('adopts when the cache still holds exactly what was pushed', () => {
    const pushed = entry()
    expect(shouldAdoptServerRow(pushed, entry())).toBe(true)
  })

  it('refuses when the row was edited while the push was in flight', () => {
    // That edit queued its own outbox op and adopts on its own push; writing the
    // server's older copy here would drop a keystroke.
    const pushed = entry()
    const edited = entry({ updated_at: '2026-07-01T00:00:05.000Z', body_markdown: 'body more' })
    expect(shouldAdoptServerRow(pushed, edited)).toBe(false)
  })

  it('refuses when the row was deleted while the push was in flight', () => {
    expect(shouldAdoptServerRow(entry(), undefined)).toBe(false)
  })
})

describe('maxUpdatedAt', () => {
  it('returns null for an empty list', () => {
    expect(maxUpdatedAt([])).toBeNull()
  })

  it('picks the newest timestamp regardless of order', () => {
    const rows = [
      entry({ id: 'a', updated_at: '2026-07-01T00:00:00.000Z' }),
      entry({ id: 'b', updated_at: '2026-07-03T00:00:00.000Z' }),
      entry({ id: 'c', updated_at: '2026-07-02T00:00:00.000Z' }),
    ]
    expect(maxUpdatedAt(rows)).toBe('2026-07-03T00:00:00.000Z')
  })
})
