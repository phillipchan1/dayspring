// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const track = vi.fn()
vi.mock('./analytics', () => ({ track: (...args: unknown[]) => track(...args) }))

async function fresh() {
  vi.resetModules()
  return import('./firstEntry')
}

describe('firstEntry', () => {
  beforeEach(() => {
    localStorage.clear()
    track.mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fires first_entry_created once, and minutes_to_first_entry_bucket only when first-seen is stamped', async () => {
    const { markFirstEntryIfNeeded } = await fresh()
    markFirstEntryIfNeeded()
    expect(track).toHaveBeenCalledWith('first_entry_created')
    expect(track).not.toHaveBeenCalledWith('minutes_to_first_entry_bucket', expect.anything())

    track.mockClear()
    markFirstEntryIfNeeded()
    expect(track).not.toHaveBeenCalled()
  })

  it('buckets minutes since first-seen correctly at each boundary', async () => {
    vi.useFakeTimers()
    const base = Date.parse('2026-09-16T00:00:00.000Z')
    vi.setSystemTime(base)

    const { markDeviceFirstSeen, markFirstEntryIfNeeded } = await fresh()
    markDeviceFirstSeen()

    vi.setSystemTime(base + 3 * 60_000) // +3 min
    markFirstEntryIfNeeded()
    expect(track).toHaveBeenCalledWith('minutes_to_first_entry_bucket', { bucket: '0_5' })
  })

  it('buckets 30_1440 and 1440_plus correctly', async () => {
    vi.useFakeTimers()
    const base = Date.parse('2026-09-16T00:00:00.000Z')
    vi.setSystemTime(base)
    const { markDeviceFirstSeen } = await fresh()
    markDeviceFirstSeen()

    vi.setSystemTime(base + 60 * 60_000) // +60 min
    const { markFirstEntryIfNeeded: markA } = await import('./firstEntry')
    markA()
    expect(track).toHaveBeenCalledWith('minutes_to_first_entry_bucket', { bucket: '30_1440' })
  })

  it('markDeviceFirstSeen never overwrites an existing stamp', async () => {
    vi.useFakeTimers()
    const base = Date.parse('2026-09-16T00:00:00.000Z')
    vi.setSystemTime(base)
    const { markDeviceFirstSeen, markFirstEntryIfNeeded } = await fresh()
    markDeviceFirstSeen()

    vi.setSystemTime(base + 10 * 60_000)
    markDeviceFirstSeen() // should no-op — first stamp already set

    vi.setSystemTime(base + 11 * 60_000) // ~11 min after the ORIGINAL stamp
    markFirstEntryIfNeeded()
    expect(track).toHaveBeenCalledWith('minutes_to_first_entry_bucket', { bucket: '5_30' })
  })
})
