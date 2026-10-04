// The engine's read step: what is stored for a page, that one unreadable page
// fails alone, and that storing replaces a page's previous read. The read itself
// (prompt, sanitizer) is keepingRead.test.ts; here it is a double.

import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabaseAdmin.js', () => ({ supabaseAdmin: vi.fn() }))

import { readEntries, readPages, readRow, storeReads, type ReadInput } from './entryRead.js'
import type { EntryReading } from './keepingRead.js'

const reading = (entryId: string): EntryReading => ({
  version: 'movements-v2-tight-denial',
  entryId,
  truncated: false,
  sentiment: {
    present: true,
    valence: -0.4,
    activation: 0.7,
    confidence: 0.8,
    emotions: [{ emotion: 'stress', intensity: 0.7, quote: 'so pressured' }],
  },
  movements: [
    {
      id: 'm1',
      quote: 'I felt so pressured at work. I am learning to leave it with You.',
      charStart: 0,
      charEnd: 64,
      subjects: [{ key: 'c:work', label: 'work', kind: 'domain' }],
      sentiment: {
        present: true,
        valence: -0.4,
        activation: 0.7,
        confidence: 0.8,
        emotions: [{ emotion: 'stress', intensity: 0.7, quote: 'so pressured' }],
      },
      ingredients: [{ kind: 'learning', quote: 'I am learning to leave it with You.', confidence: 0.9 }],
    },
  ],
})

const page = (id: string): ReadInput => ({
  id,
  created_at: '2026-09-01T12:00:00.000Z',
  body_markdown: 'I felt so pressured at work. I am learning to leave it with You.',
  wordsHash: `w-${id}`,
})

const noVocabulary = { concordance: [], kept: [] }

function fakeSb() {
  const upserts: { table: string; rows: unknown[]; opts: unknown }[] = []
  const sb = {
    from(table: string) {
      return {
        upsert(rows: unknown[], opts: unknown) {
          upserts.push({ table, rows, opts })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
  return { sb: sb as never, upserts }
}

describe('readRow', () => {
  it('stores the whole-page sentiment, a flat ingredient list, and the words it was read from', () => {
    const row = readRow('owner', 'w1', reading('e1'), new Date('2026-10-04T00:00:00Z'))
    expect(row).toMatchObject({
      entry_id: 'e1',
      owner: 'owner',
      version: 'movements-v2-tight-denial',
      words_hash: 'w1',
      present: true,
      valence: -0.4,
      activation: 0.7,
      confidence: 0.8,
      emotions: [{ emotion: 'stress', intensity: 0.7, quote: 'so pressured' }],
      ingredients: [{ kind: 'learning', quote: 'I am learning to leave it with You.', confidence: 0.9, movement: 'm1' }],
      read_at: '2026-10-04T00:00:00.000Z',
    })
    expect(row.movements).toHaveLength(1)
  })
})

describe('readPages', () => {
  it('reads each page against its own narrowed vocabulary and fails one page alone', async () => {
    const read = vi.fn(async (e: { id: string }) => {
      if (e.id === 'bad') throw new Error('model said no')
      return reading(e.id)
    })
    const { sb, upserts } = fakeSb()

    const out = await readPages(sb, 'owner', [page('a'), page('bad'), page('b')], {
      vocabulary: noVocabulary,
      read: read as never,
    })

    expect(out.rows.map((r) => r.entry_id).sort()).toEqual(['a', 'b'])
    expect(out.rows.find((r) => r.entry_id === 'a')?.words_hash).toBe('w-a')
    expect(out.failedIds).toEqual(['bad'])
    expect(upserts).toEqual([]) // readPages never writes: the dry run relies on it
  })

  it('reads nothing and loads nothing for an empty list', async () => {
    const { sb } = fakeSb()
    expect(await readPages(sb, 'owner', [])).toEqual({ rows: [], failedIds: [] })
  })
})

describe('storeReads / readEntries', () => {
  it('replaces each page’s previous read, in bounded batches', async () => {
    const { sb, upserts } = fakeSb()
    const rows = Array.from({ length: 120 }, (_, i) => readRow('owner', `w${i}`, reading(`e${i}`)))

    await storeReads(sb, rows)

    expect(upserts.map((u) => u.rows.length)).toEqual([50, 50, 20])
    expect(upserts.every((u) => u.table === 'entry_reads')).toBe(true)
    expect(upserts[0]?.opts).toEqual({ onConflict: 'entry_id' })
  })

  it('stores what it read and reports what it could not', async () => {
    const { sb, upserts } = fakeSb()
    const read = vi.fn(async (e: { id: string }) => {
      if (e.id === 'bad') throw new Error('timeout')
      return reading(e.id)
    })

    const out = await readEntries(sb, 'owner', [page('a'), page('bad')], { vocabulary: noVocabulary, read: read as never })

    expect(out).toEqual({ read: 1, failedIds: ['bad'] })
    expect(upserts).toHaveLength(1)
    expect((upserts[0]!.rows[0] as { entry_id: string }).entry_id).toBe('a')
  })

  it('throws on a database error so the engine retries the chunk', async () => {
    const sb = {
      from: () => ({ upsert: () => Promise.resolve({ error: new Error('db down') }) }),
    }
    await expect(storeReads(sb as never, [readRow('o', 'w', reading('e'))])).rejects.toThrow('db down')
  })
})
