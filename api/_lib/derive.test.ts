// The server's deterministic derive — what an IMPORTED page gets that it used to
// miss, and the two things it must never do: overwrite another account's row,
// and delete anything.
//
// The parsers are real (that is the point: one rule for a typed page and an
// imported one). Only the database is a double.

import { describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { deriveEntries } from './derive.js'
import { spiritualBlockRows } from '../../src/lib/spiritualBlocks.js'

const PRAY = '11111111-1111-4111-8111-111111111111'
const SENSE = '22222222-2222-4222-8222-222222222222'

const body = [
  'Read Romans 8:28 this morning, then Psalm 23.',
  '',
  '```dayspring-pray ' + PRAY,
  'Lord, keep her safe tonight.',
  '```',
  '',
  '```dayspring-sense ' + SENSE,
  'I felt You say: wait.',
  '```',
].join('\n')

const entry = { id: 'e1', created_at: '2019-03-04T12:00:00.000Z', body_markdown: body }

interface Tables {
  spiritual_items: { id: string; owner: string }[]
  scripture_refs: { id: string; entry_id: string; osis_ref: string; source: string }[]
}

function mockSb(existing: Partial<Tables> = {}) {
  const tables: Tables = { spiritual_items: [], scripture_refs: [], ...existing }
  const upserts: { table: string; rows: Record<string, unknown>[]; opts: unknown }[] = []
  const calls: string[] = []
  const sb = {
    from(table: keyof Tables) {
      return {
        select: () => ({
          in: (col: string, values: string[]) =>
            Promise.resolve({
              data: tables[table].filter((r) => values.includes((r as Record<string, string>)[col]!)),
              error: null,
            }),
        }),
        upsert: (rows: Record<string, unknown>[], opts: unknown) => {
          upserts.push({ table, rows, opts })
          return Promise.resolve({ error: null })
        },
        delete: () => {
          calls.push(`delete:${table}`)
          throw new Error('the server derive must never delete')
        },
      }
    },
  }
  return { sb: sb as unknown as SupabaseClient, upserts, calls }
}

describe('deriveEntries', () => {
  it('writes an imported page\'s fenced blocks as the rows a save would write', async () => {
    const { sb, upserts } = mockSb()
    const out = await deriveEntries(sb, 'owner', [entry])

    const items = upserts.find((u) => u.table === 'spiritual_items')
    // byte-for-byte what the editor's reconcile builds — same planner
    expect(items?.rows).toEqual(spiritualBlockRows('owner', 'e1', body))
    expect(items?.rows.map((r) => [r.id, r.type, r.content])).toEqual([
      [PRAY, 'prayer', 'Lord, keep her safe tonight.'],
      [SENSE, 'sense', 'I felt You say: wait.'],
    ])
    expect(items?.opts).toEqual({ onConflict: 'id' })
    expect(out.items).toBe(2)
  })

  it('captures the page\'s Scripture references, dated to the entry, owned explicitly', async () => {
    const { sb, upserts } = mockSb()
    const out = await deriveEntries(sb, 'owner', [entry])

    const refs = upserts.find((u) => u.table === 'scripture_refs')
    expect(refs?.rows.map((r) => r.osis_ref)).toEqual(['Rom.8.28', 'Ps.23'])
    for (const r of refs!.rows) {
      expect(r).toMatchObject({
        owner: 'owner', // the service role has no auth.uid() for the column default
        entry_id: 'e1',
        entry_created_at: '2019-03-04T12:00:00.000Z',
        source: 'parsed',
        status: 'confirmed',
      })
    }
    expect(refs?.opts).toEqual({ onConflict: 'entry_id,osis_ref', ignoreDuplicates: true })
    expect(out.refs).toBe(2)
  })

  it('inserts only the references that have no row yet', async () => {
    const { sb, upserts } = mockSb({
      scripture_refs: [{ id: 'r1', entry_id: 'e1', osis_ref: 'Rom.8.28', source: 'inline' }],
    })
    await deriveEntries(sb, 'owner', [entry])
    expect(upserts.find((u) => u.table === 'scripture_refs')?.rows.map((r) => r.osis_ref)).toEqual(['Ps.23'])
  })

  it('never deletes — a reference or block gone from the body is the editor\'s to prune', async () => {
    const { sb, upserts, calls } = mockSb({
      scripture_refs: [{ id: 'gone', entry_id: 'e1', osis_ref: 'John.3.16', source: 'inline' }],
    })
    await deriveEntries(sb, 'owner', [{ ...entry, body_markdown: 'Nothing here now.' }])
    expect(calls).toEqual([])
    expect(upserts).toEqual([])
  })

  // A backup restored into a different account carries fence ids that already
  // exist under the original owner, and the service role is not stopped by RLS.
  it('leaves a fence id that belongs to another account alone', async () => {
    const { sb, upserts } = mockSb({ spiritual_items: [{ id: PRAY, owner: 'someone-else' }] })
    const out = await deriveEntries(sb, 'owner', [entry])

    expect(upserts.find((u) => u.table === 'spiritual_items')?.rows.map((r) => r.id)).toEqual([SENSE])
    expect(out).toMatchObject({ items: 1, foreign: 1 })
  })

  it('refreshes a row that is already this owner\'s', async () => {
    const { sb, upserts } = mockSb({ spiritual_items: [{ id: PRAY, owner: 'owner' }] })
    await deriveEntries(sb, 'owner', [entry])
    expect(upserts.find((u) => u.table === 'spiritual_items')?.rows.map((r) => r.id)).toEqual([PRAY, SENSE])
  })

  it('does nothing for no entries', async () => {
    const { sb, upserts } = mockSb()
    expect(await deriveEntries(sb, 'owner', [])).toEqual({ items: 0, refs: 0, foreign: 0 })
    expect(upserts).toEqual([])
  })
})
