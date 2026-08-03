import { beforeEach, describe, expect, it, vi } from 'vitest'

// The local mirror is the unit under test; the network is not. Each test starts
// from an empty in-memory store standing in for IndexedDB.
const store = new Map<string, Record<string, unknown>>()

vi.mock('./db', () => ({
  marksAll: async () => [...store.values()],
  markPut: async (r: Record<string, unknown>) => {
    store.set(String(r.id), r)
  },
  markDelete: async (id: string) => {
    store.delete(id)
  },
  marksPutMany: async (rows: Record<string, unknown>[]) => {
    for (const r of rows) store.set(String(r.id), r)
  },
  marksReplaceSynced: async () => {},
}))

vi.mock('./supabase', () => ({ supabase: null }))

const { addMark, anchorOf, listMarks, markId, marksForEntry, normalizeQuote, removeMark } =
  await import('./marks')

beforeEach(() => store.clear())

describe('markId', () => {
  it('is stable for the same entry and quote', () => {
    expect(markId('e1', 'a sentence')).toBe(markId('e1', 'a sentence'))
  })

  it('ignores whitespace and case differences', () => {
    expect(markId('e1', 'A  Sentence')).toBe(markId('e1', 'a sentence'))
  })

  it('differs across entries and across quotes', () => {
    expect(markId('e1', 'a sentence')).not.toBe(markId('e2', 'a sentence'))
    expect(markId('e1', 'a sentence')).not.toBe(markId('e1', 'another sentence'))
  })

  it('is uuid-shaped, so it can be a primary key', () => {
    expect(markId('e1', 'a sentence')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })
})

describe('normalizeQuote', () => {
  it('collapses whitespace and trims', () => {
    expect(normalizeQuote('  I do not\n  think He is late  ')).toBe('I do not think He is late')
  })
})

describe('addMark', () => {
  it('stores the passage pending, and reads back immediately', async () => {
    await addMark('e1', 'I have been measuring the wrong thing')
    const out = await listMarks()
    expect(out).toHaveLength(1)
    expect(out[0]!.quote).toBe('I have been measuring the wrong thing')
    expect(store.get(out[0]!.id)!.pending).toBe('add')
  })

  it('is idempotent — marking the same sentence twice is one mark', async () => {
    await addMark('e1', 'the same sentence here')
    await addMark('e1', 'the  same sentence  here')
    expect(await listMarks()).toHaveLength(1)
  })

  it('refuses an empty or whitespace-only quote', async () => {
    expect(await addMark('e1', '   ')).toBeNull()
    expect(await listMarks()).toEqual([])
  })

  it('returns marks newest first', async () => {
    await addMark('e1', 'the older passage here')
    await new Promise((r) => setTimeout(r, 2))
    await addMark('e1', 'the newer passage here')
    expect((await listMarks())[0]!.quote).toBe('the newer passage here')
  })
})

describe('removeMark', () => {
  it('deletes outright when the mark never reached the server', async () => {
    const m = await addMark('e1', 'a passage that never synced')
    await removeMark(m!.id)
    expect(store.size).toBe(0)
  })

  it('tombstones a synced mark rather than dropping it', async () => {
    const m = await addMark('e1', 'a passage that did sync')
    store.set(m!.id, { ...store.get(m!.id)!, pending: undefined })
    await removeMark(m!.id)
    expect(store.get(m!.id)!.pending).toBe('remove')
  })

  it('hides a tombstoned mark from the list', async () => {
    const m = await addMark('e1', 'a passage that did sync')
    store.set(m!.id, { ...store.get(m!.id)!, pending: undefined })
    await removeMark(m!.id)
    expect(await listMarks()).toEqual([])
  })

  it('is a no-op for an unknown id', async () => {
    await expect(removeMark('nope')).resolves.toBeUndefined()
  })
})

describe('marksForEntry', () => {
  it('returns only that entry’s marks', async () => {
    await addMark('e1', 'belongs to entry one')
    await addMark('e2', 'belongs to entry two')
    const out = await marksForEntry('e1')
    expect(out.map((m) => m.quote)).toEqual(['belongs to entry one'])
  })
})

describe('anchorOf', () => {
  const body = 'Third month of this.\n\nI have been measuring the wrong thing.\n\nPrayed again.'
  const quote = 'I have been measuring the wrong thing.'

  it('uses the stored offset when it still points at the text', () => {
    const at = body.indexOf(quote)
    expect(anchorOf(body, { quote, charStart: at })).toBe(at)
  })

  it('re-finds the text when an edit above it moved the offset', () => {
    const edited = `A new opening paragraph.\n\n${body}`
    expect(anchorOf(edited, { quote, charStart: body.indexOf(quote) })).toBe(edited.indexOf(quote))
  })

  it('finds the text with no hint at all', () => {
    expect(anchorOf(body, { quote, charStart: null })).toBe(body.indexOf(quote))
  })

  it('matches across a line break the document has since introduced', () => {
    const wrapped = 'I have been measuring\nthe wrong thing.'
    expect(anchorOf(wrapped, { quote, charStart: null })).toBe(0)
  })

  it('returns null when the sentence is gone — orphaned, not an error', () => {
    expect(anchorOf('Something else entirely now.', { quote, charStart: 12 })).toBeNull()
  })

  it('treats regex metacharacters in the quote as literal text', () => {
    const md = 'he asked (again?) what I meant'
    expect(anchorOf(md, { quote: '(again?)', charStart: null })).toBe(md.indexOf('(again?)'))
  })
})
