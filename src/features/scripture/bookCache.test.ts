import { beforeEach, describe, expect, it, vi } from 'vitest'

const reads = vi.hoisted(() => ({
  entries: vi.fn(),
  heat: vi.fn(),
  summary: vi.fn(),
  returning: vi.fn(),
}))

vi.mock('@/lib/scripture/query', () => ({
  getBookEntries: reads.entries,
  getBookChapterHeat: reads.heat,
  getBookSummary: reads.summary,
  getReturning: reads.returning,
}))

import { clearAllCache, invalidateCachePrefix } from '@/lib/asyncCache'
import { bookCacheKey, cachedBook, loadBook } from './bookCache'

const heat = { chapters: new Map([[23, 4]]), max: 4 }
const summary = { distinctEntries: 4, rank: 1, firstDate: null, lastDate: null }

beforeEach(() => {
  clearAllCache()
  reads.entries.mockResolvedValue([{ entry_id: 'e1', entry_created_at: '2026-01-01', refs: ['Ps.23.1'], excerpt: 'x' }])
  reads.heat.mockResolvedValue(heat)
  reads.summary.mockResolvedValue(summary)
  reads.returning.mockResolvedValue([])
})

describe('the Lamp’s book cache', () => {
  it('has nothing for a book never read', () => {
    expect(cachedBook('Ps', {})).toBeUndefined()
  })

  it('keeps a reading, so the next open paints at once', async () => {
    const page = await loadBook('Ps', {})
    expect(cachedBook('Ps', {})).toEqual(page)
    expect(page.heat).toBe(heat)
  })

  it('keys by book AND window — "this year" is not "all time"', async () => {
    const thisYear = { from: new Date('2026-01-01T00:00:00Z') }
    await loadBook('Ps', thisYear)
    expect(cachedBook('Ps', thisYear)).toBeDefined()
    expect(cachedBook('Ps', {})).toBeUndefined()
    expect(cachedBook('Gen', thisYear)).toBeUndefined()
    expect(bookCacheKey('Ps', thisYear)).not.toBe(bookCacheKey('Ps', {}))
  })

  it('goes with the rest of the Lamp when a scan invalidates it', async () => {
    await loadBook('Ps', {})
    invalidateCachePrefix('scripture:')
    expect(cachedBook('Ps', {})).toBeUndefined()
  })

  it('never lands a read that outlived its owner (sign-out mid-flight)', async () => {
    let finish: (v: unknown) => void = () => {}
    reads.entries.mockReturnValue(new Promise((r) => (finish = r)))
    const pending = loadBook('Ps', {})
    clearAllCache()
    finish([])
    await expect(pending).rejects.toThrow()
    expect(cachedBook('Ps', {})).toBeUndefined()
  })
})
