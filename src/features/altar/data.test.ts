// The Altar used to paint only after a serial walk of every declared subject
// (thread ids, then `.in()` 80 at a time). A caught-up altar is thousands of
// subjects, so that was a stack of round-trips. The field read is now two
// filtered scans started together — a count riding with page 0, further pages
// in parallel — and the chunked `.in()` path is only the fallback.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllCache } from '@/lib/asyncCache'
import { buildAltarStrands } from './data'

interface Snap {
  table: string
  select: string
  head: boolean
  filters: string[]
  range: [number, number] | null
  inCount: number | null
}

interface Answer {
  data: unknown
  error: { message: string } | null
  count: number | null
}

const harness = vi.hoisted(() => {
  const calls: Snap[] = []
  let answer: (snap: Snap) => Answer | Promise<Answer> = () => ({
    data: [],
    error: null,
    count: 0,
  })
  function from(table: string) {
    const snap: Snap = { table, select: '', head: false, filters: [], range: null, inCount: null }
    const chain: Record<string, unknown> = {
      select(cols: string, opts?: { head?: boolean }) {
        snap.select = cols
        snap.head = !!opts?.head
        return chain
      },
      eq(col: string, val: unknown) {
        snap.filters.push(`${col}=${String(val)}`)
        return chain
      },
      not(col: string, op: string, val: unknown) {
        snap.filters.push(`${col}:${op}:${String(val)}`)
        return chain
      },
      in(_col: string, ids: unknown[]) {
        snap.inCount = ids.length
        return chain
      },
      order() {
        return chain
      },
      range(fromIdx: number, to: number) {
        snap.range = [fromIdx, to]
        return chain
      },
      then(onFulfilled: (v: Answer) => unknown, onRejected?: (e: unknown) => unknown) {
        const frozen: Snap = { ...snap, filters: [...snap.filters] }
        calls.push(frozen)
        return Promise.resolve(answer(frozen)).then(onFulfilled, onRejected)
      },
    }
    return chain
  }
  return {
    calls,
    setAnswer(fn: (snap: Snap) => Answer | Promise<Answer>) {
      answer = fn
    },
    client: { from },
  }
})

vi.mock('@/lib/supabase', () => ({
  requireSupabase: () => harness.client,
}))

const { loadAltarSource } = await import('./data')

const THREADS = [
  { id: 't-dad', label: 'Dad', label_ai: null, label_user: null, type: 'prayer', subject_kind: 'person' },
  { id: 't-once', label: 'Once', label_ai: null, label_user: null, type: 'sense', subject_kind: 'theme' },
]

function member(id: string, thread: string, at: string, body: string) {
  return {
    id,
    thread_id: thread,
    spiritual_item_id: id,
    register: 'bringing',
    spiritual_items: { content: body, created_at: at, entry_id: `e-${id}` },
    threads: { kind: 'declared', dismissed: false },
  }
}

const MEMBERS = [
  member('a', 't-dad', '2020-01-01T00:00:00.000Z', 'alpha line for dad'),
  member('b', 't-dad', '2022-06-01T00:00:00.000Z', 'beta line for dad'),
  member('c', 't-dad', '2024-03-01T00:00:00.000Z', 'gamma line for dad'),
  member('d', 't-once', '2024-08-01T00:00:00.000Z', 'only once'),
]

function pageOf<T>(rows: T[], snap: Snap): T[] {
  const from = snap.range?.[0] ?? 0
  const to = snap.range?.[1] ?? from
  return rows.slice(from, to + 1)
}

/** Small altar: one page of threads, one page of lines, no id-list fan-out. */
function smallAnswer(snap: Snap): Answer {
  if (snap.table === 'threads') {
    return snap.head
      ? { data: null, error: null, count: THREADS.length }
      : { data: pageOf(THREADS, snap), error: null, count: null }
  }
  if (snap.inCount != null) {
    return { data: pageOf(MEMBERS, snap), error: null, count: null }
  }
  return snap.head
    ? { data: null, error: null, count: MEMBERS.length }
    : { data: pageOf(MEMBERS, snap), error: null, count: null }
}

beforeEach(() => {
  harness.calls.length = 0
  harness.setAnswer(smallAnswer)
  clearAllCache()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('loadAltarSource', () => {
  it('reads threads and lines together, without chunking thread ids', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    harness.setAnswer(async (snap) => {
      await gate
      return smallAnswer(snap)
    })

    const pending = loadAltarSource()
    await vi.waitFor(() => {
      if (harness.calls.length === 0) throw new Error('queries not started')
    })
    const tables = harness.calls.map((c) => c.table)
    expect(tables.filter((t) => t === 'threads').length).toBeGreaterThan(0)
    expect(tables.filter((t) => t === 'thread_members').length).toBeGreaterThan(0)
    expect(harness.calls.some((c) => c.inCount != null)).toBe(false)

    const memberRead = harness.calls.find((c) => c.table === 'thread_members' && !c.head)
    expect(memberRead?.select).toContain('threads!inner')
    expect(memberRead?.filters).toContain('threads.kind=declared')
    expect(memberRead?.filters).toContain('threads.dismissed=false')

    release()
    const src = await pending
    const strands = buildAltarStrands(src, -Infinity)
    expect(strands.map((s) => s.label)).toEqual(['Dad'])
    // Temporal median of the three returns — selection, not a rewrite.
    expect(strands[0]?.repLine?.excerpt).toBe('beta line for dad')
    expect(harness.calls.some((c) => c.inCount != null)).toBe(false)
  })

  it('fetches the next page when the first one is full', async () => {
    const many = Array.from({ length: 1001 }, (_, i) =>
      member(`m${i}`, 't-dad', '2022-06-01T00:00:00.000Z', `line ${i}`),
    )
    harness.setAnswer((snap) => {
      if (snap.table === 'threads') {
        return snap.head
          ? { data: null, error: null, count: 1 }
          : { data: pageOf(THREADS.slice(0, 1), snap), error: null, count: null }
      }
      return snap.head
        ? { data: null, error: null, count: many.length }
        : { data: pageOf(many, snap), error: null, count: null }
    })

    const src = await loadAltarSource()
    const ranges = harness.calls
      .filter((c) => c.table === 'thread_members' && c.range)
      .map((c) => c.range?.[0])
    expect(ranges).toEqual([0, 1000])
    expect(src.rawMembers).toHaveLength(1001)
  })

  it('falls back to chunked id lists when the embedded read is rejected', async () => {
    harness.setAnswer((snap) => {
      if (snap.table === 'thread_members' && snap.inCount == null && !snap.head) {
        return { data: null, error: { message: 'could not find relationship' }, count: null }
      }
      return smallAnswer(snap)
    })

    const src = await loadAltarSource()
    expect(harness.calls.some((c) => c.inCount === THREADS.length)).toBe(true)
    expect(buildAltarStrands(src, -Infinity).map((s) => s.label)).toEqual(['Dad'])
    expect(console.warn).toHaveBeenCalled()
  })

  it('says it could not load when both member reads fail, rather than an empty altar', async () => {
    harness.setAnswer((snap) => {
      if (snap.table === 'thread_members' && !snap.head) {
        return { data: null, error: { message: 'offline' }, count: null }
      }
      return smallAnswer(snap)
    })
    await expect(loadAltarSource()).rejects.toThrow('Could not load')
  })

  it('is an empty altar when nothing has been declared', async () => {
    harness.setAnswer((snap) => {
      if (snap.table === 'threads') return { data: [], error: null, count: 0 }
      return { data: [], error: null, count: 0 }
    })
    const src = await loadAltarSource()
    expect(buildAltarStrands(src, -Infinity)).toEqual([])
  })

  it('shares one in-flight read across concurrent callers', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    harness.setAnswer(async (snap) => {
      await gate
      return smallAnswer(snap)
    })
    const a = loadAltarSource()
    const b = loadAltarSource()
    await vi.waitFor(() => {
      if (harness.calls.length === 0) throw new Error('queries not started')
    })
    const heads = harness.calls.filter((c) => c.table === 'thread_members' && c.head)
    expect(heads).toHaveLength(1)
    release()
    const [left, right] = await Promise.all([a, b])
    expect(left.rawThreads.map((t) => t.id)).toEqual(right.rawThreads.map((t) => t.id))
  })
})
