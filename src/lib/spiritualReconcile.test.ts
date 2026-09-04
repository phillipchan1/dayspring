// What the save-time reconcile owns, and what it must not touch.
//
// The delete used to be scoped by entry alone. That read as "the block is the
// source of truth" and meant something much larger in practice: a harvested row
// has no fence, so touching an old entry erased every prayer the journal had
// noticed on it. Measured against the real archive before the fix, 6,463 of
// 6,514 markings sat one edit away from deletion.

import { beforeEach, describe, expect, it, vi } from 'vitest'

interface Recorded {
  upserted: Record<string, unknown>[]
  deleteFilters: string[]
}
const rec: Recorded = { upserted: [], deleteFilters: [] }

function builder(kind: 'delete' | 'select') {
  const chain: Record<string, unknown> = {
    eq: () => chain,
    not: (...args: unknown[]) => {
      rec.deleteFilters.push(`not:${String(args[0])}`)
      return chain
    },
    or: (expr: string) => {
      rec.deleteFilters.push(`or:${expr}`)
      return chain
    },
    then: (resolve: (v: { error: null }) => unknown) => resolve({ error: null }),
  }
  void kind
  return chain
}

vi.mock('./supabase', () => ({
  requireSupabase: () => ({
    auth: { getSession: async () => ({ data: { session: { user: { id: 'owner-1' } } } }) },
    from: () => ({
      upsert: async (rows: Record<string, unknown>[]) => {
        rec.upserted = rows
        return { error: null }
      },
      delete: () => builder('delete'),
    }),
  }),
}))

const { syncSpiritualBlocksFromMarkdown } = await import('./spiritual')

const FENCE_ID = '11111111-2222-4333-8444-555555555555'
const body = [
  'woke early and it was quiet.',
  '',
  '```dayspring-pray ' + FENCE_ID,
  'God, be near to her today.',
  '```',
  '',
  'then the day started.',
].join('\n')

beforeEach(() => {
  rec.upserted = []
  rec.deleteFilters = []
})

describe('syncSpiritualBlocksFromMarkdown — what it owns', () => {
  it('never deletes a harvested row', async () => {
    await syncSpiritualBlocksFromMarkdown('entry-1', body)
    // The whole point: the delete is narrowed to editor-written rows. NULL is
    // included because rows predate the `source` default.
    expect(rec.deleteFilters).toContain('or:source.is.null,source.eq.command')
  })

  it('still prunes a fence the writer removed', async () => {
    await syncSpiritualBlocksFromMarkdown('entry-1', body)
    expect(rec.deleteFilters.some((f) => f.startsWith('not:id'))).toBe(true)
  })

  it('prunes every editor-written row when the last fence goes', async () => {
    await syncSpiritualBlocksFromMarkdown('entry-1', 'just prose now.')
    expect(rec.upserted).toHaveLength(0)
    expect(rec.deleteFilters).toContain('or:source.is.null,source.eq.command')
    expect(rec.deleteFilters.some((f) => f.startsWith('not:id'))).toBe(false)
  })
})

describe('syncSpiritualBlocksFromMarkdown — position', () => {
  it('records where the block sits in the body it came from', async () => {
    await syncSpiritualBlocksFromMarkdown('entry-1', body)
    const [row] = rec.upserted
    expect(row).toMatchObject({ id: FENCE_ID, type: 'prayer', entry_id: 'entry-1' })
    // Offsets are into body_markdown as stored, fences included.
    expect(body.slice(row!.char_start as number, row!.char_end as number)).toContain(
      'God, be near to her today.',
    )
    expect(body.slice(row!.char_start as number).startsWith('```dayspring-pray')).toBe(true)
  })

  it('moves the offset when text is inserted above it', async () => {
    await syncSpiritualBlocksFromMarkdown('entry-1', body)
    const before = rec.upserted[0]!.char_start as number
    await syncSpiritualBlocksFromMarkdown('entry-1', 'a new first line.\n' + body)
    expect(rec.upserted[0]!.char_start as number).toBe(before + 'a new first line.\n'.length)
  })
})
