import { describe, expect, it } from 'vitest'
import { maxUpdatedAt, shouldAdoptServerRow, shouldApplyRemote, subsumes } from './entryVersion'
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
    // A local edit bumps local_edited_at and leaves updated_at alone, so this is
    // the signal that matters. That edit queued its own outbox op and adopts on
    // its own push; writing the server's older copy here would drop a keystroke.
    const pushed = entry()
    const edited = entry({ body_markdown: 'body more', local_edited_at: 1_800_000_000_000 })
    expect(shouldAdoptServerRow(pushed, edited)).toBe(false)
  })

  it('refuses when a second edit landed on top of an already-dirty row', () => {
    const pushed = entry({ local_edited_at: 1_800_000_000_000 })
    const edited = entry({ local_edited_at: 1_800_000_005_000 })
    expect(shouldAdoptServerRow(pushed, edited)).toBe(false)
  })

  it('refuses when the row was deleted while the push was in flight', () => {
    expect(shouldAdoptServerRow(entry(), undefined)).toBe(false)
  })
})

describe('subsumes — the guard against manufacturing duplicate entries', () => {
  it('treats an append as subsuming: this device is just further along', () => {
    const theirs = 'Lord, I am weary today.'
    const ours = 'Lord, I am weary today.\n\nBut you are near.'
    expect(subsumes(ours, theirs)).toBe(true)
  })

  it('treats an identical body as subsuming — a retried push whose reply was lost', () => {
    expect(subsumes('same text', 'same text')).toBe(true)
  })

  it('ignores block-separation differences introduced by the editor', () => {
    expect(subsumes('a paragraph\n\n', '  a paragraph  ')).toBe(true)
  })

  it('treats an empty losing side as subsuming — nothing to preserve', () => {
    expect(subsumes('anything', '   \n\n ')).toBe(true)
  })

  it('does NOT subsume genuinely divergent writing — this is the case worth saving', () => {
    const ours = 'I wrote about the morning.'
    const theirs = 'I wrote about the evening instead.'
    expect(subsumes(ours, theirs)).toBe(false)
  })

  it('does NOT subsume when the other device kept text we deleted', () => {
    const ours = 'first paragraph'
    const theirs = 'first paragraph\n\nsecond paragraph they added'
    expect(subsumes(ours, theirs)).toBe(false)
  })
})

describe('shouldApplyRemote', () => {
  const clean = { pending: false, preserved: false }

  it('applies a row we have never seen', () => {
    expect(shouldApplyRemote(entry(), undefined, clean)).toBe(true)
  })

  it('applies a genuinely newer remote row', () => {
    const remote = entry({ updated_at: '2026-07-02T00:00:00.000Z', body_markdown: 'newer' })
    expect(shouldApplyRemote(remote, entry(), clean)).toBe(true)
  })

  it('skips our own echo — same timestamp, same body', () => {
    // This is the case that matters at scale: a server-side backfill emits an
    // event per entry while changing nothing, and counting those as real change
    // used to send every device into a full library download.
    expect(shouldApplyRemote(entry(), entry(), clean)).toBe(false)
  })

  it('skips a remote row older than what we hold', () => {
    const remote = entry({ updated_at: '2026-06-30T00:00:00.000Z' })
    expect(shouldApplyRemote(remote, entry(), clean)).toBe(false)
  })

  it('skips a row with a queued local write — ours is newer by definition', () => {
    const remote = entry({ updated_at: '2026-07-09T00:00:00.000Z', body_markdown: 'theirs' })
    expect(shouldApplyRemote(remote, entry(), { pending: true, preserved: false })).toBe(false)
  })

  it('skips the entry being edited on screen', () => {
    const remote = entry({ updated_at: '2026-07-09T00:00:00.000Z', body_markdown: 'theirs' })
    expect(shouldApplyRemote(remote, entry(), { pending: false, preserved: true })).toBe(false)
  })

  it('applies a same-timestamp row whose body differs', () => {
    // Not an echo — something really changed, so take it.
    const remote = entry({ body_markdown: 'different' })
    expect(shouldApplyRemote(remote, entry(), clean)).toBe(true)
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
