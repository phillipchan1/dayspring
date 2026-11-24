// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
vi.mock('./api', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
}))

const { subscribeEntryChanges, ENTRY_POLL_IDLE_MS } = await import('./entriesRealtime')
const { IDLE_AFTER_MS, setLastInputAtForTest } = await import('./presence')

function entry(id: string, updated_at: string) {
  return {
    id,
    created_at: updated_at,
    updated_at,
    body_markdown: 'hi',
    title: null,
    mood: null,
    tags: [],
    word_count: 1,
    source: 'native',
    external_id: null,
  }
}

describe('subscribeEntryChanges polling', () => {
  beforeEach(() => {
    apiGet.mockReset()
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true, writable: true })
    setLastInputAtForTest(Date.now())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('refetches on focus and visibility, and on a slow interval while visible', async () => {
    apiGet.mockResolvedValue({ entries: [entry('e1', '2026-01-01T00:00:00.000Z')] })
    const onBatch = vi.fn()
    const onReconnect = vi.fn()
    const stop = subscribeEntryChanges({ onBatch, onReconnect })

    expect(onReconnect).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/data/entries')
    })

    apiGet.mockClear()
    apiGet.mockResolvedValue({ entries: [entry('e2', '2026-01-01T00:01:00.000Z')] })
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => {
      expect(apiGet.mock.calls.some((c) => String(c[0]).startsWith('/api/data/entries?since='))).toBe(true)
    })

    apiGet.mockClear()
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => {
      expect(onReconnect).toHaveBeenCalledTimes(2)
    })

    apiGet.mockClear()
    await vi.advanceTimersByTimeAsync(ENTRY_POLL_IDLE_MS)
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalled()
    })

    stop()
  })

  it('stops polling once nobody has touched the app, so an open window lets the database sleep', async () => {
    apiGet.mockResolvedValue({ entries: [] })
    const stop = subscribeEntryChanges({ onBatch: vi.fn() })
    await vi.waitFor(() => expect(apiGet).toHaveBeenCalled())

    apiGet.mockClear()
    await vi.advanceTimersByTimeAsync(60 * 60_000) // an idle hour, window visible
    // Polls only for the first IDLE_AFTER_MS, then silence for the rest of the hour.
    expect(apiGet.mock.calls.length).toBe(Math.floor(IDLE_AFTER_MS / ENTRY_POLL_IDLE_MS))

    apiGet.mockClear()
    window.dispatchEvent(new Event('pointerdown')) // someone is back
    await vi.advanceTimersByTimeAsync(ENTRY_POLL_IDLE_MS)
    expect(apiGet).toHaveBeenCalled()
    stop()
  })
})
