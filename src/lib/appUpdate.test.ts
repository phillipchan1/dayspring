// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updater = vi.hoisted(() => ({ check: vi.fn() }))

vi.mock('@tauri-apps/plugin-updater', () => updater)
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }))
vi.mock('./platform', () => ({ isDesktopTauri: () => true }))
vi.mock('./repo', () => ({ flush: vi.fn(async () => {}) }))

async function fresh() {
  vi.resetModules()
  return import('./appUpdate')
}

beforeEach(() => {
  vi.useFakeTimers()
  updater.check.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('checkForUpdate', () => {
  it('gives every request a deadline', async () => {
    updater.check.mockResolvedValue(null)
    const m = await fresh()
    await m.checkForUpdate(true)
    expect(updater.check).toHaveBeenCalledWith({ timeout: 30_000 })
    expect(m.getSnapshot().status).toBe('up-to-date')
  })

  it('does not let a check that never settles block every later one', async () => {
    // The first check hangs for good (a request in flight as the Mac slept).
    updater.check.mockImplementationOnce(() => new Promise(() => {}))
    const m = await fresh()
    void m.checkForUpdate(false)
    await vi.advanceTimersByTimeAsync(0)

    // Pressed straight away: it says it is looking, rather than nothing.
    await m.checkForUpdate(true)
    expect(m.getSnapshot().status).toBe('checking')
    expect(updater.check).toHaveBeenCalledTimes(1)

    // Pressed once the first is clearly stuck: a new check runs and is heard.
    vi.setSystemTime(Date.now() + 70_000)
    updater.check.mockResolvedValueOnce(null)
    await m.checkForUpdate(true)
    expect(updater.check).toHaveBeenCalledTimes(2)
    expect(m.getSnapshot().status).toBe('up-to-date')
  })
})
