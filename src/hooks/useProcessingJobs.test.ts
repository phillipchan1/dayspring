// @vitest-environment jsdom
import { createElement, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()
vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
}))

const session = vi.hoisted(() => ({
  current: { user: { id: 'owner-1' }, access_token: 't.s' } as { user: { id: string }; access_token: string } | null,
}))
vi.mock('./useSession', () => ({
  useSession: () => ({ session: session.current, loading: false }),
}))

const { useProcessingJobs, JOB_POLL_ACTIVE_MS, isActive } = await import('./useProcessingJobs')

function mount(onState: (s: ReturnType<typeof useProcessingJobs>) => void): Root {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  function Probe() {
    const state = useProcessingJobs()
    useEffect(() => {
      onState(state)
    }, [state])
    return null
  }
  root.render(createElement(Probe))
  return root
}

describe('useProcessingJobs polling', () => {
  let root: Root | null = null

  beforeEach(() => {
    apiGet.mockReset()
    session.current = { user: { id: 'owner-1' }, access_token: 't.s' }
    vi.useFakeTimers()
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  afterEach(() => {
    root?.unmount()
    root = null
    vi.useRealTimers()
  })

  it('refetches on focus and polls faster while a job is active', async () => {
    apiGet.mockResolvedValue({
      jobs: [{ kind: 'gather', status: 'running', completed: 1, total: 10, updated_at: '2026-01-01T00:00:00.000Z' }],
    })
    const seen: Array<ReturnType<typeof useProcessingJobs>> = []
    await vi.waitFor(async () => {
      root = mount((s) => {
        seen.push(s)
      })
    })
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/data/jobs')
    })
    expect(isActive('running')).toBe(true)

    apiGet.mockClear()
    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/data/jobs')
    })

    apiGet.mockClear()
    await vi.advanceTimersByTimeAsync(JOB_POLL_ACTIVE_MS)
    await vi.waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith('/api/data/jobs')
    })
  })
})
